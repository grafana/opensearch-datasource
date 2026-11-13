import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { VariableQueryEditor } from './VariableQueryEditor';

jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  return { ...actual, CodeEditor: (props: any) => <textarea data-testid="code-editor" value={props.value} readOnly /> };
});

const editorProps = {
  onChange: jest.fn(),
  onRunQuery: jest.fn(),
  datasource: { sqlCompletionItemProvider: {} } as any,
};

describe('VariableQueryEditor', () => {
  it('shows the JSON query of a legacy variable', () => {
    // Grafana hands a variable that was saved before the editor existed over as
    // the string that was typed, not as an object with a query field.
    render(<VariableQueryEditor {...editorProps} query={'{"find": "terms", "field": "service"}' as any} />);

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain('"find"');
  });

  it('shows the JSON query of a variable nested in the target', () => {
    render(<VariableQueryEditor {...editorProps} query={{ refId: 'A', query: '{"find": "fields"}' } as any} />);

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain('"find"');
  });
});

describe('VariableQueryEditor switch', () => {
  it('keeps a JSON query when it is edited, without stamping a query type', () => {
    const onChange = jest.fn();
    render(
      <VariableQueryEditor
        onChange={onChange}
        onRunQuery={jest.fn()}
        datasource={{ sqlCompletionItemProvider: {} } as any}
        query={{ refId: 'A', query: '{"find": "terms"}' } as any}
      />
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"find": "fields"}' } });
    fireEvent.blur(screen.getByRole('textbox'));

    expect(onChange).toHaveBeenCalledWith({ refId: 'A', query: '{"find": "fields"}' });
  });

  it('replaces the JSON query with a SQL one when the switch is turned on', () => {
    const onChange = jest.fn();
    render(
      <VariableQueryEditor
        onChange={onChange}
        onRunQuery={jest.fn()}
        datasource={{ sqlCompletionItemProvider: {} } as any}
        query={{ refId: 'A', query: '{"find": "terms"}' } as any}
      />
    );

    fireEvent.click(screen.getByRole('switch'));

    // A JSON query is not SQL, so it is replaced and the variable becomes a SQL one.
    expect(onChange).toHaveBeenCalledWith({ refId: 'A', queryType: 'sql', query: '' });
  });

  it('opens in the SQL mode for a variable that already holds SQL', () => {
    render(
      <VariableQueryEditor
        onChange={jest.fn()}
        onRunQuery={jest.fn()}
        datasource={{ sqlCompletionItemProvider: {} } as any}
        query={{ refId: 'A', query: 'SELECT DISTINCT service FROM my_index' } as any}
      />
    );

    expect(screen.getByRole('switch')).toBeChecked();
  });
});
