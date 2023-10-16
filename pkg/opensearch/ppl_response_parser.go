package opensearch

import (
	"errors"
	"fmt"
	"time"

	simplejson "github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/opensearch-datasource/pkg/null"
	es "github.com/grafana/opensearch-datasource/pkg/opensearch/client"
	"github.com/grafana/opensearch-datasource/pkg/utils"
)

type pplResponseParser struct {
	Response *es.PPLResponse
}

func newPPLResponseParser(response *es.PPLResponse, query *Query) *pplResponseParser {
	return &pplResponseParser{
		Response: response,
	}
}

// Stores meta info on response object
type responseMeta struct {
	valueIndex      int
	timeFieldIndex  int
	timeFieldFormat string
}

func (rp *pplResponseParser) parseResponse(configuredFields es.ConfiguredFields, format string) (*backend.DataResponse, error) {
	var debugInfo *simplejson.Json
	if rp.Response.DebugInfo != nil {
		debugInfo = utils.NewJsonFromAny(rp.Response.DebugInfo)
	}

	if rp.Response.Error != nil {
		return &backend.DataResponse{
			Error: getErrorFromPPLResponse(rp.Response),
			Frames: []*data.Frame{
				{
					Meta: &data.FrameMeta{
						Custom: debugInfo,
					},
				},
			},
		}, nil
	}

	queryRes := &backend.DataResponse{
		Frames: data.Frames{},
	}

	switch format {
	case logsType:
		return rp.parseLogs(queryRes, configuredFields)
	}
	return rp.parseTimeSeries(queryRes)
}

func (rp *pplResponseParser) parseLogs(queryRes *backend.DataResponse, configuredFields es.ConfiguredFields) (*backend.DataResponse, error) {
	propNames := make(map[string]bool)
	docs := make([]map[string]interface{}, len(rp.Response.Datarows))

	for rowIdx, row := range rp.Response.Datarows {
		doc := map[string]interface{}{}

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
					return nil, err
				}
				value = *utils.NullFloatToNullableTime(ts)
			}

			doc[field.Name] = value
		}

		if configuredFields.LogLevelField != "" {
			doc["level"] = doc[configuredFields.LogLevelField]
		}

		doc = flatten(doc, maxFlattenDepth)
		for key := range doc {
			if _, ok := propNames[key]; !ok {
				propNames[key] = true
			}
		}

		docs[rowIdx] = doc
	}

	sortedPropNames := sortPropNames(propNames, []string{configuredFields.TimeField, configuredFields.LogMessageField})
	fields := processDocsToDataFrameFields(docs, sortedPropNames)

	frame := data.NewFrame("", fields...)
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}
	frame.Meta.PreferredVisualization = data.VisTypeLogs

	queryRes.Frames = append(queryRes.Frames, frame)

	return queryRes, nil
}

func (rp *pplResponseParser) parseTimeSeries(queryRes *backend.DataResponse) (*backend.DataResponse, error) {
	t, err := getTimeSeriesResponseMeta(rp.Response.Schema)
	if err != nil {
		return nil, err
	}

	newFrame := data.NewFrame(rp.getSeriesName(t.valueIndex),
		data.NewFieldFromFieldType(data.FieldTypeNullableTime, len(rp.Response.Datarows)),
		data.NewFieldFromFieldType(data.FieldTypeNullableFloat64, len(rp.Response.Datarows)),
	)

	for i, datarow := range rp.Response.Datarows {
		err := rp.addDatarow(newFrame, i, datarow, t)
		if err != nil {
			return nil, err
		}
	}

	queryRes.Frames = append(queryRes.Frames, newFrame)

	return queryRes, nil
}

func (rp *pplResponseParser) addDatarow(frame *data.Frame, i int, datarow es.Datarow, t responseMeta) error {
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

func (rp *pplResponseParser) parseValue(value interface{}) (null.Float, error) {
	number, ok := value.(float64)
	if !ok {
		return null.FloatFromPtr(nil), errors.New("found non-numerical value in value field")
	}
	return null.FloatFrom(number), nil
}

func (rp *pplResponseParser) parseTimestamp(value interface{}, format string) (null.Float, error) {
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

func (rp *pplResponseParser) getSeriesName(valueIndex int) string {
	schema := rp.Response.Schema
	return schema[valueIndex].Name
}

func getTimeSeriesResponseMeta(schema []es.FieldSchema) (responseMeta, error) {
	if len(schema) != 2 {
		return responseMeta{}, fmt.Errorf("response should have 2 fields but found %v", len(schema))
	}
	var timeIndex int
	var format string
	found := false
	for i, field := range schema {
		if field.Type == "timestamp" || field.Type == "datetime" || field.Type == "date" {
			timeIndex = i
			found = true
			if field.Type == "date" {
				format = pplDateFormat
			} else {
				format = pplTSFormat
			}
		}
	}
	if !found {
		return responseMeta{}, errors.New("a valid time field type was not found in response")
	}
	return responseMeta{valueIndex: 1 - timeIndex, timeFieldIndex: timeIndex, timeFieldFormat: format}, nil
}

func getErrorFromPPLResponse(response *es.PPLResponse) error {
	var err error
	json := utils.NewJsonFromAny(response.Error)
	reason := json.Get("reason").MustString()

	if reason != "" {
		err = errors.New(reason)
	} else {
		err = errors.New("unknown OpenSearch error response")
	}

	return err
}
