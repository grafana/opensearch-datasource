package opensearch

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	es "github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	utils "github.com/grafana/opensearch-datasource/pkg/utils"
)

const (
	luceneQueryTypeTraces = "Traces"
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
	logsType        = "logs"
	tableType       = "table"
	rawDataType     = "raw_data"
	rawDocumentType = "raw_document"
	descending      = "desc"
	// maxFlattenDepth represents the maximum depth of a multi-level object which will be joined using dot notation to
	// a single level objects by the flatten function.
	// On frontend maxDepth wasn't used but as we are processing on backend let's put a limit to avoid infinite loop.
	// 10 was chosen arbitrarily.
	maxFlattenDepth = 10
)

type responseParser struct {
	Responses        []*es.SearchResponse
	Targets          []*Query
	DebugInfo        *es.SearchDebugInfo
	ConfiguredFields es.ConfiguredFields
	DSSettings       *backend.DataSourceInstanceSettings
}

func newResponseParser(responses []*es.SearchResponse, targets []*Query, debugInfo *es.SearchDebugInfo, configuredFields es.ConfiguredFields, dsSettings *backend.DataSourceInstanceSettings) *responseParser {
	return &responseParser{
		Responses:        responses,
		Targets:          targets,
		DebugInfo:        debugInfo,
		ConfiguredFields: configuredFields,
		DSSettings:       dsSettings,
	}
}

func (rp *responseParser) parseResponse() (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	if rp.Responses == nil {
		return result, nil
	}

	queryRes := backend.DataResponse{
		Frames: data.Frames{},
	}
	// go through each response, create data frames based on type, add them to result
	for i, res := range rp.Responses {
		// grab the associated query
		target := rp.Targets[i]

		// if one of the responses is an error add debug info and error
		// and keep trying to process other responses
		if res.Error != nil {
			var debugInfo *simplejson.Json
			if rp.DebugInfo != nil && i == 0 {
				debugInfo = utils.NewJsonFromAny(rp.DebugInfo)
			}

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

		var queryType string
		if target.luceneQueryType == luceneQueryTypeTraces {
			queryType = luceneQueryTypeTraces
		} else {
			queryType = target.Metrics[0].Type
		}

		switch queryType {
		case rawDataType:
			queryRes = processRawDataResponse(res, rp.ConfiguredFields, queryRes)
		case rawDocumentType:
			queryRes = processRawDocumentResponse(res, target.RefID, queryRes)
		case logsType:
			queryRes = processLogsResponse(res, rp.ConfiguredFields, queryRes)
		case luceneQueryTypeTraces:
			if strings.HasPrefix(target.RawQuery, "traceId:") {
				queryRes = processTraceSpansResponse(res, queryRes)
			} else if target.NodeGraph {
				queryRes = processNodeGraphResponse(res, rp.DSSettings.UID, rp.DSSettings.Name, queryRes)
			} else {
				queryRes = processTraceListResponse(res, rp.DSSettings.UID, rp.DSSettings.Name, queryRes)
			}
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

func processTraceSpansResponse(res *es.SearchResponse, queryRes backend.DataResponse) backend.DataResponse {
	propNames := make(map[string]bool)
	docs := make([]map[string]interface{}, len(res.Hits.Hits))

	for hitIdx, hit := range res.Hits.Hits {
		var withKeysToObj map[string]interface{}
		if hit["_source"] != nil {
			// some k:v pairs come from OpenSearch with field names in dot notation: 'span.attributes.http@status_code': 200,
			// namely TraceSpanRow.Attributes and TraceSpanRow.Resource
			// this turns everything into maps we can index and access
			withKeysToObj = utils.FlattenNestedFieldsToObj(hit["_source"].(map[string]interface{}))
		}

		doc := map[string]interface{}{
			"_id":     hit["_id"],
			"_type":   hit["_type"],
			"_index":  hit["_index"],
			"_source": withKeysToObj,
		}

		for k, v := range withKeysToObj {
			// determine if we need to add error flags to display icons in trace panel
			spanHasError := withKeysToObj["events"] != nil && utils.SpanHasError(withKeysToObj["events"].([]interface{}))
			// some field names TraceView viz needs do not correspond to what we get from OpenSearch, this remaps them
			switch k {
			case "startTime":
				{
					startTime, err := utils.TimeFieldToMilliseconds(v)
					if err != nil {
						return backend.ErrDataResponse(500, fmt.Errorf("error parsing startTime '%+v': %w", v, err).Error())
					}
					doc[k] = startTime
					continue
				}
			case "durationInNanos":
				{
					value, isNumeric := v.(float64) // Check for float64
					if isNumeric {
						// grafana needs time in milliseconds
						duration := value * 0.000001
						doc["duration"] = duration
						continue
					} else {
						backend.Logger.Debug("durationInNanos is not a float64")
					}
				}
			case "parentSpanId":
				{
					doc["parentSpanID"] = v
					continue
				}
			case "spanId":
				{
					doc["spanID"] = v
					continue
				}
			case "name":
				{
					doc["operationName"] = v
					continue
				}
			case "resource":
				{
					resourceAttributes, ok := v.(map[string]interface{})["attributes"].(map[string]interface{})
					if resourceAttributes != nil && ok {
						transformedResourceAttributes := getKeyTraceSpanValuePairs(resourceAttributes)
						if len(transformedResourceAttributes) > 0 {
							doc["serviceTags"] = transformedResourceAttributes
						}
					}

					continue
				}
			case "traceId":
				{
					doc["traceID"] = v
					continue
				}
			case "span":
				{
					spanAttributes, ok := v.(map[string]interface{})["attributes"].(map[string]interface{})
					if spanAttributes != nil && ok {
						transformedSpanAttributes := getKeyTraceSpanValuePairs(spanAttributes)
						if spanHasError {
							transformedSpanAttributes = append(transformedSpanAttributes, map[string]interface{}{"key": "error", "value": true})
						}
						if transformedSpanAttributes != nil {
							doc["tags"] = transformedSpanAttributes
						}
					}
					continue
				}
			case "events":
				{
					spanEvents, stackTraces, err := transformTraceEventsToLogs(v.([]interface{}))
					if err != nil {
						return backend.ErrDataResponse(500, fmt.Errorf("error parsing event.time '%+v': %w", v, err).Error())
					}
					if spanHasError && stackTraces != nil {
						if spanHasError {
							doc["stackTraces"] = stackTraces
						}
					}
					doc["logs"] = spanEvents
					continue
				}
			}

			doc[k] = v
		}

		if hit["fields"] != nil {
			source, ok := hit["fields"].(map[string]interface{})
			if ok {
				for k, v := range source {
					doc[k] = v
				}
			}
		}
		for key := range doc {
			propNames[key] = true
		}
		docs[hitIdx] = doc
	}

	sortedPropNames := sortPropNames(propNames, []string{})

	fields := processDocsToDataFrameFields(docs, sortedPropNames, false)

	frame := data.NewFrame("", fields...)
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}
	frame.Meta.PreferredVisualization = data.VisTypeTrace

	queryRes.Frames = data.Frames{frame}
	return queryRes
}

func processNodeGraphResponse(res *es.SearchResponse, dsUID string, dsName string, queryRes backend.DataResponse) backend.DataResponse {
	// trace list queries are hardcoded with a fairly hardcoded response format
	// but es.SearchResponse is deliberately not typed as in other query cases it can be much more open ended
	services := res.Aggregations["service_name"].(map[string]interface{})["buckets"].([]interface{})

	// get values from raw traces response
	edge_ids := []string{}
	edge_sources := []string{}
	edge_destinations := []string{}
	edge_details := []string{}

	node_ids := []string{}
	node_titles := []string{}

	for _, s := range services {
		// if a service has multiple destination domains, we need to add every combo as a separate edge
		// for example if edge_key is "frontend" and destination_domain is ["backend", "db"] we need to add
		// two edges: "frontend" -> "backend" and "frontend" -> "db"
		// the id's for the edges would ideally be "frontend_backend"
		// then the nodeId would be "frontend" I think
		service := s.(map[string]interface{})
		edge_source := service["key"].(string)
		node_ids = append(node_ids, edge_source)
		node_titles = append(node_titles, edge_source)

		// edge_targets
		for _, destination := range service["destination_domain"].(map[string]interface{})["buckets"].([]interface{}) {
			edge_destination := destination.(map[string]interface{})["key"].(string)
			edge_id := edge_source + "_" + edge_destination
			edge_operations := []string{}
			for _, resource := range destination.(map[string]interface{})["destination_resource"].(map[string]interface{})["buckets"].([]interface{}) {
				edge_operations = append(edge_operations, resource.(map[string]interface{})["key"].(string))
			}

			edge_ids = append(edge_ids, edge_id)
			edge_sources = append(edge_sources, edge_source)
			edge_destinations = append(edge_destinations, edge_destination)
			edge_details = append(edge_details, strings.Join(edge_operations, ","))
		}
	}

	edgeFields := make([]*data.Field, 0, 3)
	// this won't work, see comment above
	// not will adding sources for an edge as an array (not supported)
	edgeFields = append(edgeFields, data.NewField("id", nil, edge_ids))
	edgeFields = append(edgeFields, data.NewField("source", nil, edge_sources))
	edgeFields = append(edgeFields, data.NewField("target", nil, edge_destinations))
	detailField := data.NewField("detail__operation", nil, edge_details)
	detailField.SetConfig(&data.FieldConfig{DisplayName: "Operation(s)"})
	edgeFields = append(edgeFields, detailField)

	edgeFrame := data.NewFrame("edges", edgeFields...)
	edgeFrame.Meta = &data.FrameMeta{
		PreferredVisualization: "nodeGraph",
	}
	queryRes.Frames = append(queryRes.Frames, edgeFrame)

	nodeFields := make([]*data.Field, 0, 2)
	nodeFields = append(nodeFields, data.NewField("id", nil, node_ids))
	nodeFields = append(nodeFields, data.NewField("title", nil, node_titles))
	nodeFrame := data.NewFrame("nodes", nodeFields...)
	nodeFrame.Meta = &data.FrameMeta{
		PreferredVisualization: "nodeGraph",
	}
	queryRes.Frames = append(queryRes.Frames, nodeFrame)
	return queryRes
}

func processTraceListResponse(res *es.SearchResponse, dsUID string, dsName string, queryRes backend.DataResponse) backend.DataResponse {
	// trace list queries are hardcoded with a fairly hardcoded response format
	// but es.SearchResponse is deliberately not typed as in other query cases it can be much more open ended
	rawTraces := res.Aggregations["traces"].(map[string]interface{})["buckets"].([]interface{})

	// get values from raw traces response
	traceIds := []string{}
	traceGroups := []string{}
	traceLatencies := []float64{}
	traceErrorCounts := []float64{}
	traceLastUpdated := []time.Time{}
	for _, t := range rawTraces {
		trace := t.(map[string]interface{})

		traceIds = append(traceIds, trace["key"].(string))
		traceGroups = append(traceGroups, trace["trace_group"].(map[string]interface{})["buckets"].([]interface{})[0].(map[string]interface{})["key"].(string))
		traceLatencies = append(traceLatencies, trace["latency"].(map[string]interface{})["value"].(float64))
		traceErrorCounts = append(traceErrorCounts, trace["error_count"].(map[string]interface{})["doc_count"].(float64))
		lastUpdated := trace["last_updated"].(map[string]interface{})["value"].(float64)
		traceLastUpdated = append(traceLastUpdated, time.Unix(0, int64(lastUpdated)*int64(time.Millisecond)))
	}

	allFields := make([]*data.Field, 0, 5)
	traceIdColumn := data.NewField("Trace Id", nil, traceIds)
	traceIdColumn.Config = &data.FieldConfig{
		Links: []data.DataLink{
			{
				Title: "Trace: ${__value.raw}",
				Internal: &data.InternalDataLink{
					Query: map[string]interface{}{
						"query":           "traceId: ${__value.raw}",
						"luceneQueryType": "Traces",
					},
					DatasourceUID:  dsUID,
					DatasourceName: dsName,
				},
			},
		},
	}

	allFields = append(allFields, traceIdColumn)
	allFields = append(allFields, data.NewField("Trace Group", nil, traceGroups))
	allFields = append(allFields, data.NewField("Latency (ms)", nil, traceLatencies))
	allFields = append(allFields, data.NewField("Error Count", nil, traceErrorCounts))
	allFields = append(allFields, data.NewField("Last Updated", nil, traceLastUpdated))

	queryRes.Frames = append(queryRes.Frames, data.Frames{data.NewFrame("Trace List", allFields...)}...)
	return queryRes
}

func processLogsResponse(res *es.SearchResponse, configuredFields es.ConfiguredFields, queryRes backend.DataResponse) backend.DataResponse {
	propNames := make(map[string]bool)
	docs := make([]map[string]interface{}, len(res.Hits.Hits))

	for hitIdx, hit := range res.Hits.Hits {
		var flattened map[string]interface{}
		if hit["_source"] != nil {
			flattened = flatten(hit["_source"].(map[string]interface{}), maxFlattenDepth)
		}

		doc := map[string]interface{}{
			"_id":     hit["_id"],
			"_type":   hit["_type"],
			"_index":  hit["_index"],
			"_source": flattened,
		}

		for k, v := range flattened {
			if configuredFields.LogLevelField != "" && k == configuredFields.LogLevelField {
				doc["level"] = v
			} else {
				doc[k] = v
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

		if timestamp, ok := getTimestamp(hit, configuredFields.TimeField); ok {
			doc[configuredFields.TimeField] = timestamp
		}

		for key := range doc {
			propNames[key] = true
		}

		docs[hitIdx] = doc
	}

	sortedPropNames := sortPropNames(propNames, []string{configuredFields.TimeField, configuredFields.LogMessageField})
	fields := processDocsToDataFrameFields(docs, sortedPropNames, true)

	frame := data.NewFrame("", fields...)
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}
	frame.Meta.PreferredVisualization = data.VisTypeLogs

	queryRes.Frames = data.Frames{frame}
	return queryRes
}

func processRawDataResponse(res *es.SearchResponse, configuredFields es.ConfiguredFields, queryRes backend.DataResponse) backend.DataResponse {
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
				for k, v := range flatten(source, maxFlattenDepth) {
					doc[k] = v
				}
			}
		}

		if timestamp, ok := getTimestamp(hit, configuredFields.TimeField); ok {
			doc[configuredFields.TimeField] = timestamp
		}

		for key := range doc {
			propNames[key] = true
		}

		documents[hitIdx] = doc
	}

	sortedPropNames := sortPropNames(propNames, []string{configuredFields.TimeField})
	fields := processDocsToDataFrameFields(documents, sortedPropNames, true)

	queryRes.Frames = data.Frames{data.NewFrame("", fields...)}
	return queryRes
}

func sortPropNames(propNames map[string]bool, fieldsToGoInFront []string) []string {
	var fieldsInFront []string
	for _, field := range fieldsToGoInFront {
		if _, ok := propNames[field]; ok && field != "" {
			fieldsInFront = append(fieldsInFront, field)
			delete(propNames, field)
		}
	}

	var sortedPropNames []string
	for k := range propNames {
		sortedPropNames = append(sortedPropNames, k)
	}
	sort.Strings(sortedPropNames)

	return append(fieldsInFront, sortedPropNames...)
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

func getTimestamp(hit map[string]interface{}, timeField string) (time.Time, bool) {
	timestamp, ok := lookForTimeFieldInFields(hit, timeField)
	if !ok {
		timestamp, ok = lookForTimeFieldInSource(hit, timeField)
		if !ok {
			return time.Time{}, false
		}
	}

	return timestamp, true
}

func lookForTimeFieldInFields(hit map[string]interface{}, timeField string) (time.Time, bool) {
	// "fields" is requested in the query with a specific format in AddTimeFieldWithStandardizedFormat
	if hit["fields"] != nil {
		if fieldsMap, ok := hit["fields"].(map[string]interface{}); ok {
			timesArray, ok := fieldsMap[timeField].([]interface{})
			// "fields" should be present as the only element in an array of timestamps
			if ok && len(timesArray) == 1 {
				if timeString, ok := timesArray[0].(string); ok {
					timeValue, err := time.Parse(time.RFC3339Nano, timeString)
					if err != nil {
						return time.Time{}, false
					}
					return timeValue, true
				}
			}
		}
	}

	return time.Time{}, false
}

func lookForTimeFieldInSource(hit map[string]interface{}, timeField string) (time.Time, bool) {
	source, ok := hit["_source"].(map[string]interface{})
	if ok && source[timeField] != nil {
		if timeString, ok := source[timeField].(string); ok {
			timeValue, err := time.Parse(time.RFC3339Nano, timeString)
			if err != nil {
				return time.Time{}, false
			}
			return timeValue, true
		}
	}

	return time.Time{}, false
}

func flatten(target map[string]interface{}, maxDepth int) map[string]interface{} {
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

func processDocsToDataFrameFields(docs []map[string]interface{}, propNames []string, isFilterable bool) []*data.Field {
	allFields := make([]*data.Field, 0, len(propNames))
	for _, propName := range propNames {
		propNameValue := findTheFirstNonNilDocValueForPropName(docs, propName)

		switch propNameValue.(type) {
		// We are checking for default data types values (time, float64, int, bool, string)
		// and default to json.RawMessage if we cannot find any of them
		case time.Time:
			allFields = append(allFields, createFieldOfType[time.Time](docs, propName, isFilterable))
		case float64:
			allFields = append(allFields, createFieldOfType[float64](docs, propName, isFilterable))
		case int:
			allFields = append(allFields, createFieldOfType[int](docs, propName, isFilterable))
		case int64:
			allFields = append(allFields, createFieldOfType[int64](docs, propName, isFilterable))
		case string:
			allFields = append(allFields, createFieldOfType[string](docs, propName, isFilterable))
		case bool:
			allFields = append(allFields, createFieldOfType[bool](docs, propName, isFilterable))
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
			field.Config = &data.FieldConfig{Filterable: &isFilterable}
			allFields = append(allFields, field)
		}
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

func createFieldOfType[T int | float64 | bool | string | int64 | time.Time](docs []map[string]interface{}, propName string, isFilterable bool) *data.Field {
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

func getKeyTraceSpanValuePairs(source map[string]interface{}) []map[string]interface{} {
	transformedAttributes := []map[string]interface{}{}
	for k, v := range source {
		transformedAttributes = append(transformedAttributes, map[string]interface{}{"key": k, "value": v})
	}
	return transformedAttributes
}

func transformTraceEventsToLogs(events []interface{}) ([]map[string]interface{}, []string, error) {
	spanEvents := []map[string]interface{}{}
	stackTraces := []string{}
	if len(events) > 0 {
		for _, event := range events {
			eventObj := event.(map[string]interface{})
			timeStamp, err := utils.TimeFieldToMilliseconds(eventObj["time"])
			if err != nil {
				return nil, nil, err
			}
			spanEvents = append(spanEvents, map[string]interface{}{"timestamp": timeStamp, "fields": []map[string]interface{}{{"key": "name", "value": eventObj["name"]}}})

			// get stack traces if error event
			attributes, ok := eventObj["attributes"].(map[string]interface{})
			if ok {
				errorValue := attributes["error"]
				if errorValue != nil {
					stackTraces = append(stackTraces, fmt.Sprintf("%s: %s", eventObj["name"], attributes["error"]))
				}
			}
		}
	}
	return spanEvents, stackTraces, nil
}
