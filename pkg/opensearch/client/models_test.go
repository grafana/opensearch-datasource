package client

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSearchResponseHitsTotalUnmarshalJSON(t *testing.T) {
	// Test cases
	tests := []struct {
		name     string
		jsonData string
		expected SearchResponseHitsTotal
	}{
		{
			name:     "should parse total as object (OpenSearch/ES 7.x+)",
			jsonData: `{"value": 100, "relation": "eq"}`,
			expected: SearchResponseHitsTotal{Value: 100, Relation: "eq"},
		},
		{
			name:     "should parse total as number (ES 6.x)",
			jsonData: `42`,
			expected: SearchResponseHitsTotal{Value: 42, Relation: "eq"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var total SearchResponseHitsTotal
			err := json.Unmarshal([]byte(tt.jsonData), &total)
			if err != nil {
				t.Fatalf("Failed to unmarshal: %v", err)
			}

			if total.Value != tt.expected.Value {
				t.Errorf("Value = %v, want %v", total.Value, tt.expected.Value)
			}
			if total.Relation != tt.expected.Relation {
				t.Errorf("Relation = %v, want %v", total.Relation, tt.expected.Relation)
			}
		})
	}
}

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
			name: "filter inside",
			filters: []Filter{
				TermsFilter{
					Key:    "filterKey",
					Values: []string{"a", "b"},
				},
			},
			want: `{"bool":{"filter":{"terms":{"filterKey":["a","b"]}}}}`,
		},
		{
			name: "must filter inside",
			must: []Filter{
				TermsFilter{
					Key:    "mustTermKey",
					Values: []string{"a", "b"},
				},
			},
			want: `{"bool":{"must":{"terms":{"mustTermKey":["a","b"]}}}}`,
		},
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
