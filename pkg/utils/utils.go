package utils

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/opensearch-datasource/pkg/null"
)

func NewJsonFromAny(data interface{}) *simplejson.Json {
	dataByte, _ := json.Marshal(data)
	dataJson, _ := simplejson.NewJson(dataByte)
	return dataJson
}

func NewRawJsonFromAny(data interface{}) []byte {
	dataByte, _ := json.Marshal(data)
	dataJson, _ := simplejson.NewJson(dataByte)
	dataJsonRaw, _ := dataJson.MarshalJSON()
	return dataJsonRaw
}

func NullFloatToNullableTime(ts null.Float) *time.Time {
	if !ts.Valid {
		return nil
	}

	timestamp := time.UnixMilli(int64(ts.Float64)).UTC()
	return &timestamp
}

func FlattenNestedFieldsToObj(field map[string]interface{}) map[string]interface{} {
	// from "span.attributes.sampler@type": "test"
	// to map[span:map[attributes:map[sampler@type:test]]]
	result := make(map[string]interface{})

	for key, value := range field {
		keys := strings.Split(key, ".")
		current := result

		for i := 0; i < len(keys)-1; i++ {
			if _, exists := current[keys[i]]; !exists {
				current[keys[i]] = make(map[string]interface{})
			}
			current = current[keys[i]].(map[string]interface{})
		}

		current[keys[len(keys)-1]] = value
	}

	return result
}

func TimeFieldToNanoseconds(date interface{}) (int64, string) {
	layout := "2006-01-02T15:04:05.000000Z"
	var timestamp *int64
	switch timeField := date.(type) {
		case string:
			t, err := time.Parse(layout, timeField)
			if err != nil {
				return 0, err.Error()
			}
			nano := t.UnixNano() / 1e6
			timestamp = &nano
		case int64:
			timestamp = &timeField
		default:
			return 0, "unrecognized time format"
	}
	return *timestamp, ""
}
func SpanHasError(spanEvents []interface{}) bool {
	for _, event := range spanEvents {
		if eventMap, ok := event.(map[string]interface{}); ok {
			attributes := eventMap["attributes"]
			if attributes, ok := attributes.(map[string]interface{}); ok {
				if attributes["error"] != nil {
					return true
				}
			}

		} else {
			log.DefaultLogger.Debug("span event is not a map")
		}
	}
	return false
}


func Pointer[T any](v T) *T { return &v }
