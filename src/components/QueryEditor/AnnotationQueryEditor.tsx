import React from 'react';

import { css } from '@emotion/css';
import { AnnotationQuery } from '@grafana/data';
import { Input, QueryField } from '@grafana/ui';

import { OpenSearchQuery } from '../../types';
import { OpenSearchQueryEditorProps } from '.';

type Props = OpenSearchQueryEditorProps & {
  annotation?: AnnotationQuery<OpenSearchQuery>;
  onAnnotationChange?: (annotation: AnnotationQuery<OpenSearchQuery>) => void;
};

const styles = {
  marginRight: css`
    margin-right: 4px;
  `,
  queryWrapper: css`
    display: flex;
    flex-grow: 1;
  `,
};

export function OpenSearchAnnotationsQueryEditor(props: Props) {
  const annotation = props.annotation!;
  const onAnnotationChange = props.onAnnotationChange!;

  return (
    <>
      <div className="gf-form-group">
        <div className={styles.queryWrapper}>
          <QueryField
            query={annotation.target?.query}
            // By default QueryField calls onChange if onBlur is not defined, this will trigger a rerender
            // And slate will claim the focus, making it impossible to leave the field.
            onBlur={() => {}}
            onChange={query =>
              onAnnotationChange({
                ...annotation,
                query,
              })
            }
            // We currently only support Lucene Queries in the annotation editor
            placeholder="Lucene Query"
            portalOrigin="opensearch"
          />
        </div>
      </div>

      <div className="gf-form-group">
        <h6>Field mappings</h6>

        <div className="gf-form-inline">
          <div className={`gf-form ${styles.marginRight}`}>
            <span className="gf-form-label">Time</span>
            <Input
              type="text"
              placeholder="@timestamp"
              value={annotation.timeField}
              onChange={e => {
                onAnnotationChange({
                  ...annotation,
                  timeField: e.currentTarget.value,
                });
              }}
            />
          </div>
          <div className={`gf-form ${styles.marginRight}`}>
            <span className="gf-form-label">Time End</span>
            <Input
              type="text"
              value={annotation.timeEndField}
              onChange={e => {
                onAnnotationChange({
                  ...annotation,
                  timeEndField: e.currentTarget.value,
                });
              }}
            />
          </div>{' '}
          <div className={`gf-form ${styles.marginRight}`}>
            <span className="gf-form-label">Text</span>
            <Input
              type="text"
              value={annotation.textField}
              onChange={e => {
                onAnnotationChange({
                  ...annotation,
                  textField: e.currentTarget.value,
                });
              }}
            />
          </div>
          <div className={`gf-form ${styles.marginRight}`}>
            <span className="gf-form-label">Tags</span>
            <Input
              type="text"
              placeholder="tags"
              value={annotation.tagsField}
              onChange={e => {
                onAnnotationChange({
                  ...annotation,
                  tagsField: e.currentTarget.value,
                });
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
