package schema_test

import (
	_ "embed"
	"maps"
	"testing"

	"github.com/grafana/dsconfig/schema"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"k8s.io/kube-openapi/pkg/spec3"
)

//go:embed dsconfig.json
var configSchemaJSON []byte

// The backend reads individual keys with simplejson and configures HTTP through the SDK.
type settings struct {
	Database                        string     `json:"database"`
	Interval                        string     `json:"interval"`
	TimeField                       string     `json:"timeField"`
	Serverless                      bool       `json:"serverless"`
	Flavor                          string     `json:"flavor"`
	Version                         string     `json:"version"`
	VersionLabel                    string     `json:"versionLabel"`
	MaxConcurrentShardRequests      int        `json:"maxConcurrentShardRequests"`
	TimeInterval                    string     `json:"timeInterval"`
	PPLEnabled                      bool       `json:"pplEnabled"`
	LogMessageField                 string     `json:"logMessageField"`
	LogLevelField                   string     `json:"logLevelField"`
	DataLinks                       []dataLink `json:"dataLinks"`
	MaxBuckets                      int64      `json:"maxBuckets"`
	KeepCookies                     []string   `json:"keepCookies"`
	Timeout                         int        `json:"timeout"`
	OAuthPassThru                   bool       `json:"oauthPassThru"`
	TLSAuth                         bool       `json:"tlsAuth"`
	TLSAuthWithCACert               bool       `json:"tlsAuthWithCACert"`
	TLSSkipVerify                   bool       `json:"tlsSkipVerify"`
	ServerName                      string     `json:"serverName"`
	SigV4Auth                       bool       `json:"sigV4Auth"`
	SigV4AuthType                   string     `json:"sigV4AuthType"`
	SigV4Region                     string     `json:"sigV4Region"`
	SigV4Profile                    string     `json:"sigV4Profile"`
	SigV4AssumeRoleARN              string     `json:"sigV4AssumeRoleArn"`
	SigV4ExternalID                 string     `json:"sigV4ExternalId"`
	SigV4UsePerDatasourceExternalID bool       `json:"sigV4UsePerDatasourceExternalId"`
	SigV4GrafanaExternalID          string     `json:"sigV4GrafanaExternalId"`
	EnableSecureSocksProxy          bool       `json:"enableSecureSocksProxy"`
	SecureSocksProxyUsername        string     `json:"secureSocksProxyUsername"`
	KeepAlive                       int        `json:"keepAlive"`
	DialTimeout                     int        `json:"dialTimeout"`
	HTTPKeepAlive                   int        `json:"httpKeepAlive"`
	TLSHandshakeTimeout             int        `json:"httpTLSHandshakeTimeout"`
	HTTPExpectContinueTimeout       int        `json:"httpExpectContinueTimeout"`
	HTTPMaxConnsPerHost             int        `json:"httpMaxConnsPerHost"`
	HTTPMaxIdleConns                int        `json:"httpMaxIdleConns"`
	HTTPMaxIdleConnsPerHost         int        `json:"httpMaxIdleConnsPerHost"`
	HTTPIdleConnTimeout             int        `json:"httpIdleConnTimeout"`
}

type dataLink struct {
	Field         string `json:"field"`
	Title         string `json:"title"`
	URL           string `json:"url"`
	DatasourceUID string `json:"datasourceUid"`
}

//go:generate go test -run TestPlugin -generateArtifacts
func TestPlugin(t *testing.T) {
	schema.RunPluginTests(t, schema.PluginUnderTest{
		ID:                "grafana-opensearch-datasource",
		ConfigSchemaJSON:  configSchemaJSON,
		SettingsJSONModel: settings{},
		SecureKeys: []string{
			"basicAuthPassword", "password", "tlsCACert", "tlsClientCert", "tlsClientKey",
			"sigV4AccessKey", "sigV4SecretKey", "sigV4SessionToken", "secureSocksProxyPassword",
		},
		SettingsExamples: &pluginschema.SettingsExamples{Examples: map[string]*spec3.Example{
			"":                    example("OpenSearch without authentication", nil, nil, nil),
			"basicAuth":           example("HTTP basic authentication", map[string]any{"basicAuth": true, "basicAuthUser": "<USERNAME>"}, nil, map[string]string{"basicAuthPassword": "<PASSWORD>"}),
			"dailyIndices":        example("Daily OpenSearch indices", nil, map[string]any{"database": "[logstash-]YYYY.MM.DD", "interval": "Daily"}, nil),
			"oauth":               example("Forward the user's OAuth identity", nil, map[string]any{"oauthPassThru": true}, nil),
			"clientTLS":           example("Mutual TLS with a private CA", nil, map[string]any{"tlsAuth": true, "tlsAuthWithCACert": true}, map[string]string{"tlsClientCert": "<CLIENT_CERT_PEM>", "tlsClientKey": "<CLIENT_KEY_PEM>", "tlsCACert": "<CA_CERT_PEM>"}),
			"privateCA":           example("TLS with a private CA", nil, map[string]any{"tlsAuthWithCACert": true}, map[string]string{"tlsCACert": "<CA_CERT_PEM>"}),
			"authorizationHeader": example("Custom authorization header", nil, map[string]any{"httpHeaderName1": "Authorization"}, map[string]string{"httpHeaderValue1": "Bearer <TOKEN>"}),
			"privateNetwork":      example("Grafana Cloud PDC private network", nil, map[string]any{"enableSecureSocksProxy": true, "secureSocksProxyUsername": "<PDC_NETWORK_ID>"}, nil),
			"awsDefault":          awsExample("AWS SDK default credentials", "default", nil, nil),
			"awsKeys":             awsExample("AWS temporary access keys", "keys", nil, map[string]string{"sigV4AccessKey": "<AWS_ACCESS_KEY_ID>", "sigV4SecretKey": "<AWS_SECRET_ACCESS_KEY>", "sigV4SessionToken": "<AWS_SESSION_TOKEN>"}),
			"awsCredentialsFile":  awsExample("AWS credentials file", "credentials", map[string]any{"sigV4Profile": "<PROFILE_NAME>"}, nil),
			"workspaceRole":       awsExample("Workspace IAM role", "ec2_iam_role", nil, nil),
			"grafanaAssumeRole":   awsExample("Grafana Assume Role with a data source-specific external ID", "grafana_assume_role", map[string]any{"sigV4AssumeRoleArn": "arn:aws:iam::123456789012:role/GrafanaOpenSearch", "sigV4UsePerDatasourceExternalId": true}, nil),
			"serverless":          awsExample("Amazon OpenSearch Serverless", "default", map[string]any{"serverless": true, "version": "1.0.0", "pplEnabled": true, "maxConcurrentShardRequests": 5}, nil),
			"elasticsearch":       example("Elasticsearch 7.10", nil, map[string]any{"flavor": "elasticsearch", "version": "7.10.2"}, nil),
		}},
	})
}

func awsExample(summary, provider string, additional map[string]any, secrets map[string]string) *spec3.Example {
	jsonData := map[string]any{"sigV4Auth": true, "sigV4AuthType": provider, "sigV4Region": "us-east-1"}
	maps.Copy(jsonData, additional)
	return example(summary, nil, jsonData, secrets)
}

func example(summary string, root, additional map[string]any, secrets map[string]string) *spec3.Example {
	jsonData := map[string]any{"flavor": "opensearch", "version": "2.18.0", "timeField": "@timestamp", "database": "<INDEX_NAME>"}
	maps.Copy(jsonData, additional)
	spec := map[string]any{"title": "OpenSearch", "url": "<OPENSEARCH_URL>", "access": "proxy", "jsonData": jsonData}
	maps.Copy(spec, root)
	value := map[string]any{
		"apiVersion": "grafana-opensearch-datasource.datasource.grafana.app/v0alpha1",
		"kind":       "DataSource",
		"metadata":   map[string]string{"name": "opensearch"},
		"spec":       spec,
	}
	if len(secrets) > 0 {
		secure := make(map[string]map[string]string, len(secrets))
		for key, placeholder := range secrets {
			secure[key] = map[string]string{"create": placeholder}
		}
		value["secure"] = secure
	}
	return &spec3.Example{ExampleProps: spec3.ExampleProps{Summary: summary, Value: value}}
}
