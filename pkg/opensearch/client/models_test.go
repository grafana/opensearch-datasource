package client

import (
	"encoding/json"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestTermsFilter_MarshalJSON(t *testing.T) {
	tests := []struct {
		name   string
		key    string
		values []string
		want   string
	}{
		{
			name:   "single key -> term, no list",
			key:    "hello",
			values: []string{"goodbye"},
			want:   `{"term":{"hello":{"value":"goodbye"}}}`,
		},
		{
			name:   "multiple values -> terms, with list",
			key:    "hello",
			values: []string{"goodbye", "hello"},
			want:   `{"terms":{"hello":["goodbye","hello"]}}`,
		},
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tf := &TermsFilter{
				Key:    tt.key,
				Values: tt.values,
			}
			got, err := tf.MarshalJSON()
			assert.Nil(t, err)
			assert.Equalf(t, tt.want, string(got), "MarshalJSON()")
		})
	}
}

func TestBoolQuery_MarshalJSON(t *testing.T) {
	tests := []struct {
		name    string
		filters []Filter
		must    []Filter
		mustNot []Filter
		should  []Filter
		want    string
	}{
		{
			name: "terms filter inside",
			mustNot: []Filter{
				TermsFilter{
					Key:    "service",
					Values: []string{"a", "b"},
				},
			},
			want: `{"bool":{"must_not":{"terms":{"service":["a","b"]}}}}`,
		},
		{
			name: "should filters with multiple terms inside bool query",
			should: []Filter{
				TermsFilter{
					Key:    "service",
					Values: []string{"a", "b"},
				},
				TermsFilter{
					Key:    "name",
					Values: []string{"bob"},
				},
			},
			want: `{"bool":{"should":[{"terms":{"service":["a","b"]}},{"term":{"name":{"value":"bob"}}}]}}`,
		},
		{
			name: "one should filter inside bool query",
			should: []Filter{
				TermsFilter{
					Key:    "service",
					Values: []string{"a", "b"},
				},
			},
			want: `{"bool":{"should":{"terms":{"service":["a","b"]}}}}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := Query{
				&BoolQuery{
					Filters:        tt.filters,
					MustFilters:    tt.must,
					MustNotFilters: tt.mustNot,
					ShouldFilters:  tt.should,
				},
			}
			got, err := json.Marshal(q)
			assert.Nil(t, err)
			assert.Equalf(t, tt.want, string(got), "MarshalJSON()")
		})
	}
}
