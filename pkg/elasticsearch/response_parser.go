package elasticsearch

import (
	"errors"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	es "github.com/grafana/open-distro-for-elasticsearch-grafana-datasource/pkg/elasticsearch/client"
	"github.com/grafana/open-distro-for-elasticsearch-grafana-datasource/pkg/null"
	"github.com/grafana/open-distro-for-elasticsearch-grafana-datasource/pkg/tsdb"
	"github.com/grafana/open-distro-for-elasticsearch-grafana-datasource/pkg/utils"
)

const (
	// Metric types
	countType         = "count"
	percentilesType   = "percentiles"
	extendedStatsType = "extended_stats"
	// Bucket types
	dateHistType    = "date_histogram"
	histogramType   = "histogram"
	filtersType     = "filters"
	termsType       = "terms"
	geohashGridType = "geohash_grid"
)

type responseParser struct {
	Responses []*es.SearchResponse
	Targets   []*Query
	DebugInfo *es.SearchDebugInfo
}

var newResponseParser = func(responses []*es.SearchResponse, targets []*Query, debugInfo *es.SearchDebugInfo) *responseParser {
	return &responseParser{
		Responses: responses,
		Targets:   targets,
		DebugInfo: debugInfo,
	}
}

func (rp *responseParser) getTimeSeries() (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	if rp.Responses == nil {
		return result, nil
	}

	for i, res := range rp.Responses {
		target := rp.Targets[i]

		var debugInfo *simplejson.Json
		if rp.DebugInfo != nil && i == 0 {
			debugInfo = utils.NewJsonFromAny(rp.DebugInfo)
		}

		if res.Error != nil {
			// result.Responses[target.RefID] = getErrorFromElasticResponse(res)
			result.Responses[target.RefID] = backend.DataResponse{
				Error: getErrorFromElasticResponse(res),
				Frames: []*data.Frame{
					{
						Meta: &data.FrameMeta{
							Custom: debugInfo,
						},
					},
				},
			}
			continue
		}

		queryRes := backend.DataResponse{
			Frames: data.Frames{},
		}
		// queryRes.Meta = debugInfo
		props := make(map[string]string)
		table := tsdb.Table{
			Columns: make([]tsdb.TableColumn, 0),
			Rows:    make([]tsdb.RowValues, 0),
		}
		err := rp.processBuckets(res.Aggregations, target, &queryRes.Frames, &table, props, 0)
		if err != nil {
			return nil, err
		}
		rp.nameSeries(&queryRes.Frames, target)
		rp.trimDatapoints(&queryRes.Frames, target)

		// if len(table.Rows) > 0 {
		// 	queryRes.Tables = append(queryRes.Tables, &table)
		// }

		result.Responses[target.RefID] = queryRes
	}
	return result, nil
}

func (rp *responseParser) processBuckets(aggs map[string]interface{}, target *Query, series *data.Frames, table *tsdb.Table, props map[string]string, depth int) error {
	var err error
	maxDepth := len(target.BucketAggs) - 1

	aggIDs := make([]string, 0)
	for k := range aggs {
		aggIDs = append(aggIDs, k)
	}
	sort.Strings(aggIDs)
	for _, aggID := range aggIDs {
		v := aggs[aggID]
		aggDef, _ := findAgg(target, aggID)
		esAgg := utils.NewJsonFromAny(v)
		if aggDef == nil {
			continue
		}

		if depth == maxDepth {
			if aggDef.Type == dateHistType {
				err = rp.processMetrics(esAgg, target, series, props)
			} else {
				err = rp.processAggregationDocs(esAgg, aggDef, target, table, props)
			}
			if err != nil {
				return err
			}
		} else {
			for _, b := range esAgg.Get("buckets").MustArray() {
				bucket := utils.NewJsonFromAny(b)
				newProps := make(map[string]string)

				for k, v := range props {
					newProps[k] = v
				}

				if key, err := bucket.Get("key").String(); err == nil {
					newProps[aggDef.Field] = key
				} else if key, err := bucket.Get("key").Int64(); err == nil {
					newProps[aggDef.Field] = strconv.FormatInt(key, 10)
				}

				if key, err := bucket.Get("key_as_string").String(); err == nil {
					newProps[aggDef.Field] = key
				}
				err = rp.processBuckets(bucket.MustMap(), target, series, table, newProps, depth+1)
				if err != nil {
					return err
				}
			}

			buckets := esAgg.Get("buckets").MustMap()
			bucketKeys := make([]string, 0)
			for k := range buckets {
				bucketKeys = append(bucketKeys, k)
			}
			sort.Strings(bucketKeys)

			for _, bucketKey := range bucketKeys {
				bucket := utils.NewJsonFromAny(buckets[bucketKey])
				newProps := make(map[string]string)

				for k, v := range props {
					newProps[k] = v
				}

				newProps["filter"] = bucketKey

				err = rp.processBuckets(bucket.MustMap(), target, series, table, newProps, depth+1)
				if err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func (rp *responseParser) processMetrics(esAgg *simplejson.Json, target *Query, frames *data.Frames, props map[string]string) error {
	for _, metric := range target.Metrics {
		if metric.Hide {
			continue
		}

		switch metric.Type {
		case countType:
			// newSeries := tsdb.TimeSeries{
			// 	Tags: make(map[string]string),
			// }
			buckets := esAgg.Get("buckets").MustArray()
			newFrame := data.NewFrame(target.Alias,
				data.NewFieldFromFieldType(data.FieldTypeNullableTime, len(buckets)),
				data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, len(buckets)),
			)
			valueField := newFrame.Fields[1]
			valueField.Labels = data.Labels{}

			for i, v := range buckets {
				bucket := utils.NewJsonFromAny(v)
				value := castToNullFloat(bucket.Get("doc_count"))
				key := castToNullFloat(bucket.Get("key"))
				setFrameRow(newFrame, i, key, value)
				// newSeries.Points = append(newSeries.Points, tsdb.TimePoint{value, key})
			}

			for k, v := range props {
				valueField.Labels[k] = v
			}
			valueField.Labels["metric"] = countType
			*frames = append(*frames, newFrame)

		case percentilesType:
			buckets := esAgg.Get("buckets").MustArray()
			if len(buckets) == 0 {
				break
			}

			firstBucket := utils.NewJsonFromAny(buckets[0])
			percentiles := firstBucket.GetPath(metric.ID, "values").MustMap()

			percentileKeys := make([]string, 0)
			for k := range percentiles {
				percentileKeys = append(percentileKeys, k)
			}
			sort.Strings(percentileKeys)
			for _, percentileName := range percentileKeys {
				newFrame := data.NewFrame(target.Alias,
					data.NewFieldFromFieldType(data.FieldTypeNullableTime, len(buckets)),
					data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, len(buckets)),
				)
				valueField := newFrame.Fields[1]
				valueField.Labels = data.Labels{}

				for k, v := range props {
					valueField.Labels[k] = v
				}
				valueField.Labels["metric"] = "p" + percentileName
				valueField.Labels["field"] = metric.Field

				for i, v := range buckets {
					bucket := utils.NewJsonFromAny(v)
					value := castToNullFloat(bucket.GetPath(metric.ID, "values", percentileName))
					key := castToNullFloat(bucket.Get("key"))
					setFrameRow(newFrame, i, key, value)
					// newSeries.Points = append(newSeries.Points, tsdb.TimePoint{value, key})
				}
				*frames = append(*frames, newFrame)
			}
		case extendedStatsType:
			buckets := esAgg.Get("buckets").MustArray()

			metaKeys := make([]string, 0)
			meta := metric.Meta.MustMap()
			for k := range meta {
				metaKeys = append(metaKeys, k)
			}
			sort.Strings(metaKeys)
			for _, statName := range metaKeys {
				v := meta[statName]
				if enabled, ok := v.(bool); !ok || !enabled {
					continue
				}

				newFrame := data.NewFrame(target.Alias,
					data.NewFieldFromFieldType(data.FieldTypeNullableTime, len(buckets)),
					data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, len(buckets)),
				)
				valueField := newFrame.Fields[1]
				valueField.Labels = data.Labels{}

				for k, v := range props {
					valueField.Labels[k] = v
				}
				valueField.Labels["metric"] = statName
				valueField.Labels["field"] = metric.Field

				for i, v := range buckets {
					bucket := utils.NewJsonFromAny(v)
					key := castToNullFloat(bucket.Get("key"))
					var value null.Float
					switch statName {
					case "std_deviation_bounds_upper":
						value = castToNullFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "upper"))
					case "std_deviation_bounds_lower":
						value = castToNullFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "lower"))
					default:
						value = castToNullFloat(bucket.GetPath(metric.ID, statName))
					}
					setFrameRow(newFrame, i, key, value)
					// newSeries.Points = append(newSeries.Points, tsdb.TimePoint{value, key})
				}
				*frames = append(*frames, newFrame)
			}
		default:
			buckets := esAgg.Get("buckets").MustArray()

			newFrame := data.NewFrame(target.Alias,
				data.NewFieldFromFieldType(data.FieldTypeNullableTime, len(buckets)),
				data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, len(buckets)),
			)
			valueField := newFrame.Fields[1]
			valueField.Labels = data.Labels{}

			for k, v := range props {
				valueField.Labels[k] = v
			}
			valueField.Labels["metric"] = metric.Type
			valueField.Labels["field"] = metric.Field
			valueField.Labels["metricId"] = metric.ID

			for i, v := range buckets {
				bucket := utils.NewJsonFromAny(v)
				key := castToNullFloat(bucket.Get("key"))
				valueObj, err := bucket.Get(metric.ID).Map()
				if err != nil {
					continue
				}
				var value null.Float
				if _, ok := valueObj["normalized_value"]; ok {
					value = castToNullFloat(bucket.GetPath(metric.ID, "normalized_value"))
				} else {
					value = castToNullFloat(bucket.GetPath(metric.ID, "value"))
				}
				setFrameRow(newFrame, i, key, value)
				// newSeries.Points = append(newSeries.Points, tsdb.TimePoint{value, key})
			}
			*frames = append(*frames, newFrame)
		}
	}
	return nil
}

func (rp *responseParser) processAggregationDocs(esAgg *simplejson.Json, aggDef *BucketAgg, target *Query, table *tsdb.Table, props map[string]string) error {
	propKeys := make([]string, 0)
	for k := range props {
		propKeys = append(propKeys, k)
	}
	sort.Strings(propKeys)

	if len(table.Columns) == 0 {
		for _, propKey := range propKeys {
			table.Columns = append(table.Columns, tsdb.TableColumn{Text: propKey})
		}
		table.Columns = append(table.Columns, tsdb.TableColumn{Text: aggDef.Field})
	}

	addMetricValue := func(values *tsdb.RowValues, metricName string, value null.Float) {
		found := false
		for _, c := range table.Columns {
			if c.Text == metricName {
				found = true
				break
			}
		}
		if !found {
			table.Columns = append(table.Columns, tsdb.TableColumn{Text: metricName})
		}
		*values = append(*values, value)
	}

	for _, v := range esAgg.Get("buckets").MustArray() {
		bucket := utils.NewJsonFromAny(v)
		values := make(tsdb.RowValues, 0)

		for _, propKey := range propKeys {
			values = append(values, props[propKey])
		}

		if key, err := bucket.Get("key").String(); err == nil {
			values = append(values, key)
		} else {
			values = append(values, castToNullFloat(bucket.Get("key")))
		}

		for _, metric := range target.Metrics {
			switch metric.Type {
			case countType:
				addMetricValue(&values, rp.getMetricName(metric.Type), castToNullFloat(bucket.Get("doc_count")))
			case extendedStatsType:
				metaKeys := make([]string, 0)
				meta := metric.Meta.MustMap()
				for k := range meta {
					metaKeys = append(metaKeys, k)
				}
				sort.Strings(metaKeys)
				for _, statName := range metaKeys {
					v := meta[statName]
					if enabled, ok := v.(bool); !ok || !enabled {
						continue
					}

					var value null.Float
					switch statName {
					case "std_deviation_bounds_upper":
						value = castToNullFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "upper"))
					case "std_deviation_bounds_lower":
						value = castToNullFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "lower"))
					default:
						value = castToNullFloat(bucket.GetPath(metric.ID, statName))
					}

					addMetricValue(&values, rp.getMetricName(metric.Type), value)
					break
				}
			default:
				metricName := rp.getMetricName(metric.Type)
				otherMetrics := make([]*MetricAgg, 0)

				for _, m := range target.Metrics {
					if m.Type == metric.Type {
						otherMetrics = append(otherMetrics, m)
					}
				}

				if len(otherMetrics) > 1 {
					metricName += " " + metric.Field
					if metric.Type == "bucket_script" {
						// Use the formula in the column name
						metricName = metric.Settings.Get("script").MustString("")
					}
				}

				addMetricValue(&values, metricName, castToNullFloat(bucket.GetPath(metric.ID, "value")))
			}
		}

		table.Rows = append(table.Rows, values)
	}

	return nil
}

func (rp *responseParser) trimDatapoints(frames *data.Frames, target *Query) {
	var histogram *BucketAgg
	for _, bucketAgg := range target.BucketAggs {
		if bucketAgg.Type == dateHistType {
			histogram = bucketAgg
			break
		}
	}

	if histogram == nil {
		return
	}

	trimEdges, err := histogram.Settings.Get("trimEdges").Int()
	if err != nil {
		return
	}

	for _, f := range *frames {
		if f.Rows() > trimEdges*2 {
			for i := 0; i < trimEdges; i++ {
				f.DeleteRow(i)
			}
			for i := f.Rows() - trimEdges; i < f.Rows(); i++ {
				f.DeleteRow(i)
			}
			// f.Points = f.Points[trimEdges : len(f.Points)-trimEdges]
		}
	}
}

func (rp *responseParser) nameSeries(frames *data.Frames, target *Query) {
	set := make(map[string]string)
	for _, v := range *frames {
		if len(v.Fields) > 1 {
			valueField := v.Fields[1]
			if metricType, exists := valueField.Labels["metric"]; exists {
				if _, ok := set[metricType]; !ok {
					set[metricType] = ""
				}
			}
		}
	}
	metricTypeCount := len(set)
	for _, series := range *frames {
		series.Name = rp.getSeriesName(series, target, metricTypeCount)
	}
}

var aliasPatternRegex = regexp.MustCompile(`\{\{([\s\S]+?)\}\}`)

func (rp *responseParser) getSeriesName(series *data.Frame, target *Query, metricTypeCount int) string {
	if len(series.Fields) < 2 {
		return target.Alias
	}

	valueField := series.Fields[1]
	metricType := valueField.Labels["metric"]
	metricName := rp.getMetricName(metricType)
	delete(valueField.Labels, "metric")

	field := ""
	if v, ok := valueField.Labels["field"]; ok {
		field = v
		delete(valueField.Labels, "field")
	}

	if target.Alias != "" {
		seriesName := target.Alias

		subMatches := aliasPatternRegex.FindAllStringSubmatch(target.Alias, -1)
		for _, subMatch := range subMatches {
			group := subMatch[0]

			if len(subMatch) > 1 {
				group = subMatch[1]
			}

			if strings.Index(group, "term ") == 0 {
				seriesName = strings.Replace(seriesName, subMatch[0], valueField.Labels[group[5:]], 1)
			}
			if v, ok := valueField.Labels[group]; ok {
				seriesName = strings.Replace(seriesName, subMatch[0], v, 1)
			}
			if group == "metric" {
				seriesName = strings.Replace(seriesName, subMatch[0], metricName, 1)
			}
			if group == "field" {
				seriesName = strings.Replace(seriesName, subMatch[0], field, 1)
			}
		}

		return seriesName
	}
	// todo, if field and pipelineAgg
	if field != "" && isPipelineAgg(metricType) {
		if isPipelineAggWithMultipleBucketPaths(metricType) {
			metricID := ""
			if v, ok := valueField.Labels["metricId"]; ok {
				metricID = v
			}

			for _, metric := range target.Metrics {
				if metric.ID == metricID {
					metricName = metric.Settings.Get("script").MustString()
					for name, pipelineAgg := range metric.PipelineVariables {
						for _, m := range target.Metrics {
							if m.ID == pipelineAgg {
								metricName = strings.ReplaceAll(metricName, "params."+name, describeMetric(m.Type, m.Field))
							}
						}
					}
				}
			}
		} else {
			found := false
			for _, metric := range target.Metrics {
				if metric.ID == field {
					metricName += " " + describeMetric(metric.Type, field)
					found = true
				}
			}
			if !found {
				metricName = "Unset"
			}
		}
	} else if field != "" {
		metricName += " " + field
	}

	delete(valueField.Labels, "metricId")

	if len(valueField.Labels) == 0 {
		return metricName
	}

	name := ""
	for _, v := range valueField.Labels {
		name += v + " "
	}

	if metricTypeCount == 1 {
		return strings.TrimSpace(name)
	}

	return strings.TrimSpace(name) + " " + metricName
}

func (rp *responseParser) getMetricName(metric string) string {
	if text, ok := metricAggType[metric]; ok {
		return text
	}

	if text, ok := extendedStats[metric]; ok {
		return text
	}

	return metric
}

func castToNullFloat(j *simplejson.Json) null.Float {
	f, err := j.Float64()
	if err == nil {
		return null.FloatFrom(f)
	}

	if s, err := j.String(); err == nil {
		if strings.ToLower(s) == "nan" {
			return null.NewFloat(0, false)
		}

		if v, err := strconv.ParseFloat(s, 64); err == nil {
			return null.FloatFromPtr(&v)
		}
	}

	return null.NewFloat(0, false)
}

func findAgg(target *Query, aggID string) (*BucketAgg, error) {
	for _, v := range target.BucketAggs {
		if aggID == v.ID {
			return v, nil
		}
	}
	return nil, errors.New("can't found aggDef, aggID:" + aggID)
}

func getErrorFromElasticResponse(response *es.SearchResponse) error {
	var err error
	json := utils.NewJsonFromAny(response.Error)
	reason := json.Get("reason").MustString()
	rootCauseReason := json.Get("root_cause").GetIndex(0).Get("reason").MustString()

	switch {
	case rootCauseReason != "":
		err = errors.New(rootCauseReason)
	case reason != "":
		err = errors.New(reason)
	default:
		err = errors.New("Unknown elasticsearch error response")
	}

	return err
}

func setFrameRow(frame *data.Frame, i int, key, value null.Float) {
	frame.Set(0, i, nullFloatToNullableTime(key))

	if value.Valid {
		frame.Set(1, i, &value.Float64)
	} else {
		frame.Set(1, i, nil)
	}
}

func nullFloatToNullableTime(ts null.Float) *time.Time {
	if !ts.Valid {
		return nil
	}

	sec, fract := math.Modf(ts.Float64)
	nsec := int64(fract * float64(time.Second))
	timestamp := time.Unix(int64(sec), nsec)
	return &timestamp
}
