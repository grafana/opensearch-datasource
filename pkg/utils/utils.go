package utils

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/bitly/go-simplejson"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/opensearch-datasource/pkg/null"
)

const (
	TimeFormat = "2006-01-02T15:04:05.999999999Z"
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

func TimeFieldToMilliseconds(date interface{}) (int64, error) {
	var timestamp *int64
	switch timeField := date.(type) {
	case string:
		t, err := time.Parse(TimeFormat, timeField)
		if err != nil {
			return 0, err
		}
		nano := t.UnixNano() / 1e6
		timestamp = &nano
	case int64:
		timestamp = &timeField
	default:
		return 0, errors.New("unrecognized time format")
	}
	return *timestamp, nil
}
func SpanHasError(spanEvents []interface{}) bool {
	for _, event := range spanEvents {
		eventMap, ok := event.(map[string]interface{})
		if !ok {
			log.DefaultLogger.Debug("span event is not a map")
			continue
		}
		attributes, ok := eventMap["attributes"].(map[string]interface{})
		if !ok {
			log.DefaultLogger.Debug("event attribute is not a map")
			continue
		}
		if attributes["error"] != nil {
			return true
		}
	}
	return false
}

func Pointer[T any](v T) *T { return &v }

func StringToIntWithDefaultValue(valueStr string, defaultValue int) int {
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		value = defaultValue
	}
	// In our case, 0 is not a valid value and in this case we default to defaultValue
	if value == 0 {
		value = defaultValue
	}
	return value
}
