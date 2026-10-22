package opensearch

import (
	"errors"
	"fmt"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/opensearch-datasource/pkg/null"
	"github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/utils"
)

type sqlResponseParser struct {
	Response *client.SQLResponse
}

func newSQLResponseParser(response *client.SQLResponse) *sqlResponseParser {
	return &sqlResponseParser{
		Response: response,
	}
}

// Stores meta info on response object
type sqlResponseMeta struct {
	valueIndex      int
	timeFieldIndex  int
	timeFieldFormat string
}

func (rp *sqlResponseParser) parseResponse(configuredFields client.ConfiguredFields, format string) (*backend.DataResponse, error) {
	var debugInfo *simplejson.Json
	if rp.Response.DebugInfo != nil {
		debugInfo = utils.NewJsonFromAny(rp.Response.DebugInfo)
	}

	if rp.Response.Error != nil {
		errResp := backend.ErrorResponseWithErrorSource(backend.DownstreamError(getErrorFromSQLResponse(rp.Response)))
		errResp.Frames = []*data.Frame{
			{
				Meta: &data.FrameMeta{
					Custom: debugInfo,
				},
			}}
		return &errResp, nil
	}

	queryRes := &backend.DataResponse{
		Frames: data.Frames{},
	}

	switch format {
	case logsType:
		return rp.parseLogs(queryRes, configuredFields)
	case tableType:
		return rp.parseTables(queryRes)
	default:
		return rp.parseTimeSeries(queryRes)
	}
}

func (rp *sqlResponseParser) parseTables(queryRes *backend.DataResponse) (*backend.DataResponse, error) {
	return rp.parseSQLResponse(queryRes, client.ConfiguredFields{}, false)
}

func (rp *sqlResponseParser) parseLogs(queryRes *backend.DataResponse, configuredFields client.ConfiguredFields) (*backend.DataResponse, error) {
	return rp.parseSQLResponse(queryRes, configuredFields, true)
}

// parseSQLResponse parses responses for the logs and table format. SQL returns
// the same schema/datarows shape as PPL, so the parsing logic mirrors it.
func (rp *sqlResponseParser) parseSQLResponse(queryRes *backend.DataResponse, configuredFields client.ConfiguredFields, isLogsQuery bool) (*backend.DataResponse, error) {
	propNames := make(map[string]bool)
	docs := make([]map[string]interface{}, len(rp.Response.Datarows))

	for rowIdx, row := range rp.Response.Datarows {
		doc := map[string]interface{}{}

		// convert every timestamp, datetime or date to the correct format
		for fieldIdx, field := range rp.Response.Schema {
			value := row[fieldIdx]
			fieldType := field.Type

			if fieldType == "timestamp" || fieldType == "datetime" || fieldType == "date" {
				timestampFormat := pplTSFormat
				if fieldType == "date" {
					timestampFormat = pplDateFormat
				}
				ts, err := rp.parseTimestamp(row[fieldIdx], timestampFormat)
				if err != nil {
					errResp := backend.ErrorResponseWithErrorSource(backend.PluginError(err))
					return &errResp, nil
				}
				value = *utils.NullFloatToNullableTime(ts)
			}

			doc[field.Name] = value
		}

		if isLogsQuery && configuredFields.LogLevelField != "" {
			doc["level"] = doc[configuredFields.LogLevelField]
		}

		doc = flatten(doc, maxFlattenDepth)
		for key := range doc {
			if !isLogsQuery && key == "_source" {
				continue
			}
			if _, ok := propNames[key]; !ok {
				propNames[key] = true
			}
		}

		docs[rowIdx] = doc
	}

	sortedPropNames := sortPropNames(propNames, []string{configuredFields.TimeField, configuredFields.LogMessageField})
	fields := processDocsToDataFrameFields(docs, sortedPropNames, true)

	frame := data.NewFrame("", fields...)
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}

	frame.Meta.PreferredVisualization = data.VisTypeLogs
	if !isLogsQuery {
		frame.Meta.PreferredVisualization = data.VisTypeTable
	}

	queryRes.Frames = append(queryRes.Frames, frame)

	return queryRes, nil
}

func (rp *sqlResponseParser) parseTimeSeries(queryRes *backend.DataResponse) (*backend.DataResponse, error) {
	t, err := getTimeSeriesSQLMeta(rp.Response.Schema, rp.Response.Datarows)
	if err != nil {
		errResp := backend.ErrorResponseWithErrorSource(backend.PluginError(err))
		return &errResp, nil
	}

	valueName := rp.getSeriesName(t.valueIndex)
	newFrame := data.NewFrame(valueName,
		data.NewFieldFromFieldType(data.FieldTypeNullableTime, len(rp.Response.Datarows)),
		data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, len(rp.Response.Datarows)),
	)
	newFrame.Fields[1].Name = valueName

	for i, datarow := range rp.Response.Datarows {
		err := rp.addDatarow(newFrame, i, datarow, t)
		if err != nil {
			errResp := backend.ErrorResponseWithErrorSource(backend.PluginError(err))
			return &errResp, nil
		}
	}

	queryRes.Frames = append(queryRes.Frames, newFrame)
	return queryRes, nil
}

func (rp *sqlResponseParser) addDatarow(frame *data.Frame, i int, datarow client.Datarow, t sqlResponseMeta) error {
	value, err := rp.parseValue(datarow[t.valueIndex])
	if err != nil {
		return err
	}

	timestamp, err := rp.parseTimestamp(datarow[t.timeFieldIndex], t.timeFieldFormat)
	if err != nil {
		return err
	}

	frame.Set(0, i, utils.NullFloatToNullableTime(timestamp))
	if value.Valid {
		frame.Set(1, i, &value.Float64)
	} else {
		frame.Set(1, i, nil)
	}
	return nil
}

func (rp *sqlResponseParser) parseValue(value interface{}) (null.Float, error) {
	number, ok := value.(float64)
	if !ok {
		return null.FloatFromPtr(nil), errors.New("found non-numerical value in value field")
	}
	return null.FloatFrom(number), nil
}

func (rp *sqlResponseParser) parseTimestamp(value interface{}, format string) (null.Float, error) {
	timestampString, ok := value.(string)
	if !ok {
		return null.FloatFromPtr(nil), errors.New("unable to parse time field")
	}
	timestamp, err := time.Parse(format, timestampString)
	if err != nil {
		return null.FloatFromPtr(nil), err
	}
	return null.FloatFrom(float64(timestamp.UnixNano()) / float64(time.Millisecond)), nil
}

func (rp *sqlResponseParser) getSeriesName(valueIndex int) string {
	schema := rp.Response.Schema
	return schema[valueIndex].Name
}

// getTimeSeriesSQLMeta determines which of the two columns holds the timestamp and which holds
// the value. The declared column types are preferred, but they cannot always be trusted: the
// SQL date_histogram aggregation returns its bucket key as a date string in a column that the
// engine types as "double", so the values are inspected when no column is typed as a time
// field.
func getTimeSeriesSQLMeta(schema []client.FieldSchema, datarows []client.Datarow) (sqlResponseMeta, error) {
	if len(schema) != 2 {
		return sqlResponseMeta{}, fmt.Errorf("response should have 2 fields but found %v", len(schema))
	}

	timeIndex, format, found := timeFieldFromSchema(schema)
	if !found {
		timeIndex, format, found = timeFieldFromValues(schema, datarows)
	}
	if !found {
		return sqlResponseMeta{}, errors.New("a valid time field type was not found in response")
	}

	var valueIndex int
	if timeIndex == 0 {
		valueIndex = 1
	}
	return sqlResponseMeta{valueIndex: valueIndex, timeFieldIndex: timeIndex, timeFieldFormat: format}, nil
}

// timeFieldFromSchema locates the time field by its declared type.
func timeFieldFromSchema(schema []client.FieldSchema) (int, string, bool) {
	for i, field := range schema {
		switch field.Type {
		case "timestamp", "datetime":
			return i, pplTSFormat, true
		case "date":
			return i, pplDateFormat, true
		}
	}
	return 0, "", false
}

// timeFieldFromValues locates the time field by inspecting the returned values. It is only used
// when the schema declares no time field. A column qualifies only when every string value in it
// parses with a known date layout; if both columns qualify the time field is ambiguous and
// detection fails, so a misidentified column cannot silently produce a broken frame.
func timeFieldFromValues(schema []client.FieldSchema, datarows []client.Datarow) (int, string, bool) {
	index, format := -1, ""
	for i := range schema {
		columnFormat, ok := timeColumnFormat(datarows, i)
		if !ok {
			continue
		}
		if index != -1 {
			return 0, "", false
		}
		index, format = i, columnFormat
	}
	if index == -1 {
		return 0, "", false
	}
	return index, format, true
}

// timeColumnFormat reports whether every string value in the column parses with one of the date
// layouts the SQL plugin emits for date_histogram buckets, and returns that layout.
func timeColumnFormat(datarows []client.Datarow, column int) (string, bool) {
	layouts := []string{pplTSFormat, pplDateFormat}
	valid := make([]bool, len(layouts))
	for i := range valid {
		valid[i] = true
	}

	seen := false
	for _, row := range datarows {
		if column >= len(row) {
			continue
		}
		value, ok := row[column].(string)
		if !ok {
			continue
		}
		seen = true
		for i, layout := range layouts {
			if valid[i] {
				if _, err := time.Parse(layout, value); err != nil {
					valid[i] = false
				}
			}
		}
	}
	if !seen {
		return "", false
	}
	for i, ok := range valid {
		if ok {
			return layouts[i], true
		}
	}
	return "", false
}

func getErrorFromSQLResponse(response *client.SQLResponse) error {
	json := utils.NewJsonFromAny(response.Error)
	reason := json.Get("reason").MustString()

	if reason != "" {
		return errors.New(reason)
	}

	return errors.New("unknown OpenSearch error response")
}
