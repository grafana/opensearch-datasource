import React, { useCallback, useState } from 'react';
import { OpenSearchQuery, QueryType } from 'types';
import { EditorHeader } from '@grafana/plugin-ui';
import { Button } from '@grafana/ui';
import { SampleQueriesModal } from '../SampleQueries/SampleQueriesModal';
import { trackSampleModalClick } from 'tracking';

interface QueryEditorHeaderProps {
  query: OpenSearchQuery;
  onChange: (query: OpenSearchQuery) => void;
}

export const QueryEditorHeader = ({ query, onChange }: QueryEditorHeaderProps) => {
  const [isSampleQueriesModalOpen, setIsSampleQueriesModalOpen] = useState(false);

  const openSampleQueriesModal = useCallback(() => {
    trackSampleModalClick(query.queryType || QueryType.PPL);
    setIsSampleQueriesModalOpen(true);
  }, [query]);

  return (
    <EditorHeader>
      <Button data-testid="sample-query-button" variant="secondary" size="sm" onClick={openSampleQueriesModal}>
        Kickstart your query
      </Button>
      <SampleQueriesModal
        queryLanguage={query.queryType || QueryType.PPL}
        onSelectSampleQuery={(queryString) => {
          onChange({ ...query, query: queryString });
        }}
        isOpen={isSampleQueriesModalOpen}
        onClose={() => setIsSampleQueriesModalOpen(false)}
      />
    </EditorHeader>
  );
};
