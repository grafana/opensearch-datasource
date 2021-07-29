import React, { useState } from 'react';
import { defaultPPLFormat } from '../../../query_def';
import { useQuery } from '../OpenSearchQueryContext';
import { QueryEditorRow } from '../QueryEditorRow';
import { SettingsEditor } from './SettingsEditor';
import { OpenCloseButton } from './OpenCloseButton';
import { HelpMessage } from './HelpMessage';

export const PPLFormatEditor = () => {
  const { format } = useQuery();

  const [displayHelp, setDisplayHelp] = useState(false);

  return (
    <>
      <QueryEditorRow label="Format">
        <SettingsEditor value={format ?? defaultPPLFormat()} />
        <OpenCloseButton label="Show help" open={displayHelp} onClick={() => setDisplayHelp(!displayHelp)} />
      </QueryEditorRow>
      {displayHelp && <HelpMessage />}
    </>
  );
};
