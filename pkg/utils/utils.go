package utils

import (
	"encoding/json"
	"time"

	"github.com/bitly/go-simplejson"
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

func Pointer[T any](v T) *T { return &v }
