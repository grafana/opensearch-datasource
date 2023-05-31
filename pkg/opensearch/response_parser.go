package opensearch

import (
	"errors"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	es "github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/utils"
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
			result.Responses[target.RefID] = backend.DataResponse{
				Error: getErrorFromOpenSearchResponse(res),
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
		props := make(map[string]string)
		err := rp.processBuckets(res.Aggregations, target, &queryRes, props, 0)
		if err != nil {
			return nil, err
		}
		rp.nameFields(&queryRes.Frames, target)
		rp.trimDatapoints(&queryRes.Frames, target)

		result.Responses[target.RefID] = queryRes
	}
	return result, nil
}

func (rp *responseParser) processBuckets(aggs map[string]interface{}, target *Query, queryResult *backend.DataResponse, props map[string]string, depth int) error {
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
				err = rp.processMetrics(esAgg, target, &queryResult.Frames, props)
			} else {
				err = rp.processAggregationDocs(esAgg, aggDef, target, queryResult, props)
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
				err = rp.processBuckets(bucket.MustMap(), target, queryResult, newProps, depth+1)
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

				err = rp.processBuckets(bucket.MustMap(), target, queryResult, newProps, depth+1)
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
			buckets := esAgg.Get("buckets").MustArray()
			labels := make(map[string]string, len(props))
			timeVector := make([]*time.Time, 0, len(buckets))
			values := make([]*float64, 0, len(buckets))

			for _, v := range buckets {
				bucket := utils.NewJsonFromAny(v)
				timeValue, err := getAsTime(bucket.Get("key"))
				if err != nil {
					return err
				}

				timeVector = append(timeVector, &timeValue)
				values = append(values, castToFloat(bucket.Get("doc_count")))
			}

			for k, v := range props {
				labels[k] = v
			}
			labels["metric"] = countType
			*frames = append(*frames, data.Frames{newTimeSeriesFrame(timeVector, labels, values)}...)

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
				labels := make(map[string]string, len(props))
				timeVector := make([]*time.Time, 0, len(buckets))
				values := make([]*float64, 0, len(buckets))

				for k, v := range props {
					labels[k] = v
				}
				labels["metric"] = "p" + percentileName
				labels["field"] = metric.Field

				for _, v := range buckets {
					bucket := utils.NewJsonFromAny(v)
					timeValue, err := getAsTime(bucket.Get("key"))
					if err != nil {
						return err
					}
					timeVector = append(timeVector, &timeValue)
					values = append(values, castToFloat(bucket.GetPath(metric.ID, "values", percentileName)))
				}
				*frames = append(*frames, data.Frames{newTimeSeriesFrame(timeVector, labels, values)}...)
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

				labels := make(map[string]string, len(props))
				timeVector := make([]*time.Time, 0, len(buckets))
				values := make([]*float64, 0, len(buckets))

				for k, v := range props {
					labels[k] = v
				}
				labels["metric"] = statName
				labels["field"] = metric.Field

				for _, v := range buckets {
					bucket := utils.NewJsonFromAny(v)
					timeValue, err := getAsTime(bucket.Get("key"))
					if err != nil {
						return err
					}
					var value *float64
					switch statName {
					case "std_deviation_bounds_upper":
						value = castToFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "upper"))
					case "std_deviation_bounds_lower":
						value = castToFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "lower"))
					default:
						value = castToFloat(bucket.GetPath(metric.ID, statName))
					}
					timeVector = append(timeVector, &timeValue)
					values = append(values, value)
				}
				*frames = append(*frames, data.Frames{newTimeSeriesFrame(timeVector, labels, values)}...)
			}
		default:
			buckets := esAgg.Get("buckets").MustArray()
			tags := make(map[string]string, len(props))
			timeVector := make([]*time.Time, 0, len(buckets))
			values := make([]*float64, 0, len(buckets))

			for k, v := range props {
				tags[k] = v
			}
			tags["metric"] = metric.Type
			tags["field"] = metric.Field
			tags["metricId"] = metric.ID

			for _, v := range buckets {
				bucket := utils.NewJsonFromAny(v)
				timeValue, err := getAsTime(bucket.Get("key"))
				if err != nil {
					return err
				}
				valueObj, err := bucket.Get(metric.ID).Map()
				if err != nil {
					continue
				}
				var value *float64
				if _, ok := valueObj["normalized_value"]; ok {
					value = castToFloat(bucket.GetPath(metric.ID, "normalized_value"))
				} else {
					value = castToFloat(bucket.GetPath(metric.ID, "value"))
				}
				timeVector = append(timeVector, &timeValue)
				values = append(values, value)
			}
			*frames = append(*frames, data.Frames{newTimeSeriesFrame(timeVector, tags, values)}...)
		}
	}
	return nil
}

func newTimeSeriesFrame(timeData []*time.Time, labels map[string]string, values []*float64) *data.Frame {
	frame := data.NewFrame("",
		data.NewField(data.TimeSeriesTimeFieldName, nil, timeData),
		data.NewField(data.TimeSeriesValueFieldName, labels, values))
	frame.Meta = &data.FrameMeta{
		Type: data.FrameTypeTimeSeriesMulti,
	}
	return frame
}

func getAsTime(j *simplejson.Json) (time.Time, error) {
	// these are stored as numbers
	number, err := j.Float64()
	if err != nil {
		return time.Time{}, err
	}

	return time.UnixMilli(int64(number)).UTC(), nil
}

func (rp *responseParser) processAggregationDocs(esAgg *simplejson.Json, aggDef *BucketAgg, target *Query, queryResult *backend.DataResponse, props map[string]string) error {
	propKeys := make([]string, 0)
	for k := range props {
		propKeys = append(propKeys, k)
	}
	sort.Strings(propKeys)
	frames := data.Frames{}
	var fields []*data.Field

	if queryResult.Frames == nil {
		for _, propKey := range propKeys {
			fields = append(fields, data.NewField(propKey, nil, []*string{}))
		}
	}

	addMetricValue := func(values []interface{}, metricName string, value *float64) {
		index := -1
		for i, f := range fields {
			if f.Name == metricName {
				index = i
				break
			}
		}
		var field data.Field
		if index == -1 {
			field = *data.NewField(metricName, nil, []*float64{})
			fields = append(fields, &field)
		} else {
			field = *fields[index]
		}
		field.Append(value)
	}

	for _, v := range esAgg.Get("buckets").MustArray() {
		bucket := utils.NewJsonFromAny(v)
		var values []interface{}

		found := false
		for _, e := range fields {
			for _, propKey := range propKeys {
				if e.Name == propKey {
					e.Append(props[propKey])
				}
			}
			if e.Name == aggDef.Field {
				found = true
				if key, err := bucket.Get("key").String(); err == nil {
					e.Append(&key)
				} else {
					f, err := bucket.Get("key").Float64()
					if err != nil {
						return err
					}
					e.Append(&f)
				}
			}
		}

		if !found {
			var aggDefField *data.Field
			if key, err := bucket.Get("key").String(); err == nil {
				aggDefField = extractDataField(aggDef.Field, &key)
				aggDefField.Append(&key)
			} else {
				f, err := bucket.Get("key").Float64()
				if err != nil {
					return err
				}
				aggDefField = extractDataField(aggDef.Field, &f)
				aggDefField.Append(&f)
			}
			fields = append(fields, aggDefField)
		}

		for _, metric := range target.Metrics {
			switch metric.Type {
			case countType:
				addMetricValue(values, rp.getMetricName(metric.Type), castToFloat(bucket.Get("doc_count")))
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

					var value *float64
					switch statName {
					case "std_deviation_bounds_upper":
						value = castToFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "upper"))
					case "std_deviation_bounds_lower":
						value = castToFloat(bucket.GetPath(metric.ID, "std_deviation_bounds", "lower"))
					default:
						value = castToFloat(bucket.GetPath(metric.ID, statName))
					}

					addMetricValue(values, rp.getMetricName(metric.Type), value)
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

				addMetricValue(values, metricName, castToFloat(bucket.GetPath(metric.ID, "value")))
			}
		}

		var dataFields []*data.Field
		dataFields = append(dataFields, fields...)

		frames = data.Frames{
			&data.Frame{
				Fields: dataFields,
			},
		}
	}

	queryResult.Frames = frames
	return nil
}

func extractDataField(name string, v interface{}) *data.Field {
	switch v.(type) {
	case *string:
		return data.NewField(name, nil, []*string{})
	case *float64:
		return data.NewField(name, nil, []*float64{})
	default:
		return &data.Field{}
	}
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
		}
	}
}

func (rp *responseParser) nameFields(frames *data.Frames, target *Query) {
	set := make(map[string]struct{})
	for _, v := range *frames {
		for _, vv := range v.Fields {
			if metricType, exists := vv.Labels["metric"]; exists {
				if _, ok := set[metricType]; !ok {
					set[metricType] = struct{}{}
				}
			}
		}
	}
	metricTypeCount := len(set)
	for _, series := range *frames {
		if series.Meta != nil && series.Meta.Type == data.FrameTypeTimeSeriesMulti {
			// if it is a time-series-multi, it means it has two columns, one is "time",
			// another is "number"
			valueField := series.Fields[1]
			if valueField.Config == nil {
				valueField.Config = &data.FieldConfig{}
			}
			valueField.Config.DisplayNameFromDS = rp.getFieldName(series, target, metricTypeCount)
		}
	}
}

var aliasPatternRegex = regexp.MustCompile(`\{\{([\s\S]+?)\}\}`)

func (rp *responseParser) getFieldName(series *data.Frame, target *Query, metricTypeCount int) string {
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
					metricName += " " + describeMetric(metric.Type, metric.Field)
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

func castToFloat(j *simplejson.Json) *float64 {
	f, err := j.Float64()
	if err == nil {
		return &f
	}

	if s, err := j.String(); err == nil {
		if strings.ToLower(s) == "nan" {
			return nil
		}

		if v, err := strconv.ParseFloat(s, 64); err == nil {
			return &v
		}
	}

	return nil
}

func findAgg(target *Query, aggID string) (*BucketAgg, error) {
	for _, v := range target.BucketAggs {
		if aggID == v.ID {
			return v, nil
		}
	}
	return nil, errors.New("can't found aggDef, aggID:" + aggID)
}

func getErrorFromOpenSearchResponse(response *es.SearchResponse) error {
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
		err = errors.New("unknown OpenSearch error response")
	}

	return err
}
