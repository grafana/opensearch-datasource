import React, { useRef } from 'react';
import { AnnotationQuery } from '@grafana/data';
import { CodeEditor, InlineField, InlineFieldRow, Input, Monaco, monacoTypes, QueryField, Select } from '@grafana/ui';

import { OpenSearchQuery, QueryType } from '../../types';
import { OpenSearchQueryEditorProps } from '.';
import { getQueryTypeOptions } from './QueryTypeEditor/utils';
import { registerLanguage } from 'language/monarch/register';
import language from 'language/sql/definition';

type Props = OpenSearchQueryEditorProps & {
  annotation?: AnnotationQuery<OpenSearchQuery>;
  onAnnotationChange?: (annotation: AnnotationQuery<OpenSearchQuery>) => void;
};

/**
 * The editor of an annotation.
 *
 * An annotation is edited outside the query editor, so it cannot use the context
 * the query editor provides: the datasource comes from the props instead.
 *
 * A Lucene annotation is a Lucene query and a SQL annotation is a SQL query. A
 * SQL query selects its columns itself, so the columns the annotation reads are
 * configured by name below.
 */
export function OpenSearchAnnotationsQueryEditor({ annotation, onAnnotationChange, datasource }: Props) {
  const target: OpenSearchQuery = annotation?.target ?? {
    refId: 'annotation_query',
    queryType: QueryType.Lucene,
    query: '',
  };
  const queryType = target.queryType ?? QueryType.Lucene;
  const disposalRef = useRef<monacoTypes.IDisposable>();

  const updateTarget = (patch: Partial<OpenSearchQuery>) => {
    onAnnotationChange?.({ ...(annotation as AnnotationQuery<OpenSearchQuery>), target: { ...target, ...patch } });
  };

  const update = (patch: Partial<AnnotationQuery<OpenSearchQuery>>) => {
    onAnnotationChange?.({ ...(annotation as AnnotationQuery<OpenSearchQuery>), ...patch });
  };

  const queryTypeOptions = getQueryTypeOptions(datasource.getSupportedQueryTypes());

  const onBeforeEditorMount = async (monaco: Monaco) => {
    disposalRef.current = await registerLanguage(monaco, language, datasource.sqlCompletionItemProvider);
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query type" labelWidth={16}>
          <Select
            inputId="annotation-query-type"
            width={20}
            options={queryTypeOptions}
            value={queryTypeOptions.find((option) => option.value === queryType) ?? queryTypeOptions[0]}
            onChange={(option) => updateTarget({ queryType: option.value })}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField label="Query" labelWidth={16} grow>
          {queryType === QueryType.SQL ? (
            <CodeEditor
              height={100}
              width="100%"
              language={language.id}
              value={target.query ?? ''}
              onBeforeEditorMount={onBeforeEditorMount}
              onBlur={(value: string) => updateTarget({ query: value })}
              onSave={(value: string) => updateTarget({ query: value })}
              showMiniMap={false}
              showLineNumbers={true}
              aria-label="SQL query of the annotation"
            />
          ) : (
            <QueryField
              query={target.query}
              // By default QueryField calls onChange if onBlur is not defined, this will trigger a rerender
              // And slate will claim the focus, making it impossible to leave the field.
              onBlur={() => {}}
              onChange={(query) => updateTarget({ query })}
              // A PPL annotation would be sent to the Lucene search, so only Lucene is offered.
              placeholder={queryType === QueryType.PPL ? 'PPL is not supported in annotations' : 'Lucene query'}
              portalOrigin="opensearch"
            />
          )}
        </InlineField>
      </InlineFieldRow>

      <div className="gf-form-group">
        <h6>Field mappings</h6>

        <InlineFieldRow>
          <InlineField label="Time" labelWidth={16} tooltip="The column that holds the time of the annotation.">
            <Input
              type="text"
              placeholder="@timestamp"
              value={annotation?.timeField ?? ''}
              onChange={(e) => update({ timeField: e.currentTarget.value })}
            />
          </InlineField>
          <InlineField label="Time End" labelWidth={12} tooltip="The column that holds the end of a range annotation.">
            <Input
              type="text"
              value={annotation?.timeEndField ?? ''}
              onChange={(e) => update({ timeEndField: e.currentTarget.value })}
            />
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow>
          <InlineField label="Text" labelWidth={16} tooltip="The column that holds the text of the annotation.">
            <Input
              type="text"
              value={annotation?.textField ?? ''}
              onChange={(e) => update({ textField: e.currentTarget.value })}
            />
          </InlineField>
          <InlineField label="Tags" labelWidth={12} tooltip="The column that holds the tags of the annotation.">
            <Input
              type="text"
              placeholder="tags"
              value={annotation?.tagsField ?? ''}
              onChange={(e) => update({ tagsField: e.currentTarget.value })}
            />
          </InlineField>
        </InlineFieldRow>
      </div>
    </>
  );
}
