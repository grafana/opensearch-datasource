package opensearch

import (
	"encoding/json"
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
	rawDataType     = "raw_data"
	rawDocumentType = "raw_document"
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

func (rp *responseParser) getTimeSeries(configuredFields es.ConfiguredFields) (*backend.QueryDataResponse, error) {
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

		switch target.Metrics[0].Type {
		case rawDataType:
			queryRes = processRawDataResponse(res, configuredFields.TimeField, queryRes)
		case rawDocumentType:
			queryRes = processRawDocumentResponse(res, target.RefID, queryRes)
		default:
			props := make(map[string]string)
			err := rp.processBuckets(res.Aggregations, target, &queryRes, props, 0)
			if err != nil {
				return nil, err
			}
			rp.nameFields(&queryRes.Frames, target)
			rp.trimDatapoints(&queryRes.Frames, target)
		}

		result.Responses[target.RefID] = queryRes
	}
	return result, nil
}

func processRawDataResponse(res *es.SearchResponse, timeField string, queryRes backend.DataResponse) backend.DataResponse {
	propNames := make(map[string]bool)
	documents := make([]map[string]interface{}, len(res.Hits.Hits))
	for hitIdx, hit := range res.Hits.Hits {
		doc := map[string]interface{}{
			"_id":    hit["_id"],
			"_type":  hit["_type"],
			"_index": hit["_index"],
		}

		if hit["_source"] != nil {
			source, ok := hit["_source"].(map[string]interface{})
			if ok {
				// On frontend maxDepth wasn't used but as we are processing on backend
				// let's put a limit to avoid infinite loop. 10 was chosen arbitrarily.
				for k, v := range flatten(source, 10) {
					doc[k] = v
				}
			}
		}

		if timestamp, ok := getTimestamp(hit, doc, timeField); ok {
			doc[timeField] = timestamp
		}

		for key := range doc {
			propNames[key] = true
		}

		documents[hitIdx] = doc
	}
	fields := processDocsToDataFrameFields(documents, propNames)

	queryRes.Frames = data.Frames{data.NewFrame("", fields...)}
	return queryRes
}

func processRawDocumentResponse(res *es.SearchResponse, refID string, queryRes backend.DataResponse) backend.DataResponse {
	documents := make([]map[string]interface{}, len(res.Hits.Hits))
	for hitIdx, hit := range res.Hits.Hits {
		doc := map[string]interface{}{
			"_id":    hit["_id"],
			"_type":  hit["_type"],
			"_index": hit["_index"],
		}

		if hit["_source"] != nil {
			source, ok := hit["_source"].(map[string]interface{})
			if ok {
				for k, v := range source {
					doc[k] = v
				}
			}
		}

		if hit["fields"] != nil {
			source, ok := hit["fields"].(map[string]interface{})
			if ok {
				for k, v := range source {
					doc[k] = v
				}
			}
		}

		documents[hitIdx] = doc
	}

	fieldVector := make([]*json.RawMessage, len(res.Hits.Hits))
	for i, doc := range documents {
		bytes, err := json.Marshal(doc)
		if err != nil {
			// We skip docs that can't be marshalled
			// should not happen
			continue
		}
		value := json.RawMessage(bytes)
		fieldVector[i] = &value
	}

	isFilterable := true
	field := data.NewField(refID, nil, fieldVector)
	field.Config = &data.FieldConfig{Filterable: &isFilterable}

	queryRes.Frames = data.Frames{data.NewFrame(refID, field)}
	return queryRes
}

func getTimestamp(hit, source map[string]interface{}, timeField string) (*time.Time, bool) {
	// "fields" is requested in the query with a specific format in AddTimeFieldWithStandardizedFormat
	timeString, ok := lookForTimeFieldInFields(hit, timeField)
	if !ok {
		// When "fields" is absent, then getTimestamp tries to find a timestamp in _source
		timeString, ok = lookForTimeFieldInSource(source, timeField)
		if !ok {
			// When both "fields" and "_source" timestamps are not present in the expected JSON structure, nil time.Time is returned
			return nil, false
		}
	}

	timeValue, err := time.Parse(time.RFC3339Nano, timeString)
	if err != nil {
		// For an invalid format, nil time.Time is returned
		return nil, false
	}

	return &timeValue, true
}

func lookForTimeFieldInFields(hit map[string]interface{}, timeField string) (string, bool) {
	// "fields" should be present with an array of timestamps
	if hit["fields"] != nil {
		if fieldsMap, ok := hit["fields"].(map[string]interface{}); ok {
			timesArray, ok := fieldsMap[timeField].([]interface{})
			if !ok {
				return "", false
			}
			if len(timesArray) == 1 {
				if timeString, ok := timesArray[0].(string); ok {
					return timeString, true
				}
			}
		}
	}
	return "", false
}

func lookForTimeFieldInSource(source map[string]interface{}, timeField string) (string, bool) {
	if source[timeField] != nil {
		if timeString, ok := source[timeField].(string); ok {
			return timeString, true
		}
	}

	return "", false
}

func flatten(target map[string]interface{}, maxDepth int) map[string]interface{} {
	// On frontend maxDepth wasn't used but as we are processing on backend
	// let's put a limit to avoid infinite loop. 10 was chosen arbitrary.
	output := make(map[string]interface{})
	step(0, maxDepth, target, "", output)
	return output
}

func step(currentDepth, maxDepth int, target map[string]interface{}, prev string, output map[string]interface{}) {
	nextDepth := currentDepth + 1
	for key, value := range target {
		newKey := strings.Trim(prev+"."+key, ".")

		v, ok := value.(map[string]interface{})
		if ok && len(v) > 0 && currentDepth < maxDepth {
			step(nextDepth, maxDepth, v, newKey, output)
		} else {
			output[newKey] = value
		}
	}
}

func processDocsToDataFrameFields(docs []map[string]interface{}, propNames map[string]bool) []*data.Field {
	allFields := make([]*data.Field, 0, len(propNames))
	var timeDataField *data.Field
	for propName := range propNames {
		propNameValue := findTheFirstNonNilDocValueForPropName(docs, propName)
		switch propNameValue.(type) {
		// We are checking for default data types values (float64, int, bool, string)
		// and default to json.RawMessage if we cannot find any of them
		case *time.Time:
			timeDataField = createTimeField(docs, propName)
		case float64:
			allFields = append(allFields, createFieldOfType[float64](docs, propName))
		case int:
			allFields = append(allFields, createFieldOfType[int](docs, propName))
		case string:
			allFields = append(allFields, createFieldOfType[string](docs, propName))
		case bool:
			allFields = append(allFields, createFieldOfType[bool](docs, propName))
		default:
			fieldVector := make([]*json.RawMessage, len(docs))
			for i, doc := range docs {
				bytes, err := json.Marshal(doc[propName])
				if err != nil {
					// We skip values that cannot be marshalled
					continue
				}
				value := json.RawMessage(bytes)
				fieldVector[i] = &value
			}
			field := data.NewField(propName, nil, fieldVector)
			isFilterable := true
			field.Config = &data.FieldConfig{Filterable: &isFilterable}
			allFields = append(allFields, field)
		}
	}

	sort.Slice(allFields, func(i, j int) bool {
		return allFields[i].Name < allFields[j].Name
	})

	if timeDataField != nil {
		allFields = append([]*data.Field{timeDataField}, allFields...)
	}

	return allFields
}

func findTheFirstNonNilDocValueForPropName(docs []map[string]interface{}, propName string) interface{} {
	for _, doc := range docs {
		if doc[propName] != nil {
			return doc[propName]
		}
	}
	return docs[0][propName]
}

func createTimeField(docs []map[string]interface{}, timeField string) *data.Field {
	isFilterable := true
	fieldVector := make([]*time.Time, len(docs))
	for i, doc := range docs {
		value, ok := doc[timeField].(*time.Time) // cannot use generic function below because the type is already a pointer
		if !ok {
			continue
		}
		fieldVector[i] = value
	}
	field := data.NewField(timeField, nil, fieldVector)
	field.Config = &data.FieldConfig{Filterable: &isFilterable}
	return field
}

func createFieldOfType[T int | float64 | bool | string](docs []map[string]interface{}, propName string) *data.Field {
	isFilterable := true
	fieldVector := make([]*T, len(docs))
	for i, doc := range docs {
		value, ok := doc[propName].(T)
		if !ok {
			continue
		}
		fieldVector[i] = &value
	}
	field := data.NewField(propName, nil, fieldVector)
	field.Config = &data.FieldConfig{Filterable: &isFilterable}
	return field
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

	for _, v := range esAgg.Get("buckets").MustArray() {
		bucket := utils.NewJsonFromAny(v)

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
			} else {
				f, err := bucket.Get("key").Float64()
				if err != nil {
					return err
				}
				aggDefField = extractDataField(aggDef.Field, &f)
			}
			fields = append(fields, aggDefField)
		}

		for _, metric := range target.Metrics {
			switch metric.Type {
			case countType:
				fields = addMetricValue(fields, rp.getMetricName(metric.Type), castToFloat(bucket.Get("doc_count")))
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

					fields = addMetricValue(fields, rp.getMetricName(metric.Type), value)
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

				fields = addMetricValue(fields, metricName, castToFloat(bucket.GetPath(metric.ID, "value")))
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

func addMetricValue(fields []*data.Field, metricName string, value *float64) []*data.Field {
	var index int
	found := false
	for i, f := range fields {
		if f.Name == metricName {
			index = i
			found = true
			break
		}
	}

	var newField *data.Field
	if !found {
		newField = data.NewField(metricName, nil, []*float64{})
		fields = append(fields, newField)
	} else {
		newField = fields[index]
	}
	newField.Append(value)
	return fields
}

func extractDataField[KeyType *string | *float64](name string, key KeyType) *data.Field {
	field := data.NewField(name, nil, []KeyType{})
	isFilterable := true
	field.Config = &data.FieldConfig{Filterable: &isFilterable}
	field.Append(key)
	return field
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
