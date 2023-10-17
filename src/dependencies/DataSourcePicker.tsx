// Libraries
import React, { PureComponent } from 'react';

// Components
import { HorizontalGroup, Select } from '@grafana/ui';
import { SelectableValue, DataSourceInstanceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { isUnsignedPluginSignature, PluginSignatureBadge } from './PluginSignatureBadge';
import { getDataSourceSrv } from '@grafana/runtime';

type OldDataSourceInstanceSettings = Omit<DataSourceInstanceSettings, 'access'>;

export interface Props {
  onChange: (ds: OldDataSourceInstanceSettings) => void;
  current: string | null;
  hideTextValue?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  openMenuOnFocus?: boolean;
  placeholder?: string;
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  annotations?: boolean;
  variables?: boolean;
  pluginId?: string;
  noDefault?: boolean;
}

export interface State {
  error?: string;
}

export class DataSourcePicker extends PureComponent<Props, State> {
  dataSourceSrv = getDataSourceSrv();

  static defaultProps: Partial<Props> = {
    autoFocus: false,
    openMenuOnFocus: false,
    placeholder: 'Select datasource',
  };

  state: State = {};

  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    const { current } = this.props;
    // @ts-ignore
    const dsSettings = this.dataSourceSrv.getInstanceSettings(current);
    if (!dsSettings) {
      this.setState({ error: 'Could not find data source ' + current });
    }
  }

  onChange = (item: SelectableValue<string>) => {
    // @ts-ignore
    const dsSettings = this.dataSourceSrv.getInstanceSettings(item.value);

    if (dsSettings) {
      this.props.onChange(dsSettings);
      this.setState({ error: undefined });
    }
  };

  private getCurrentValue() {
    const { current, hideTextValue, noDefault } = this.props;

    if (!current && noDefault) {
      return null;
    }

    // @ts-ignore
    const ds = this.dataSourceSrv.getInstanceSettings(current);

    if (ds) {
      return {
        label: ds.name.substr(0, 37),
        value: ds.name,
        imgUrl: ds.meta.info.logos.small,
        hideText: hideTextValue,
        meta: ds.meta,
      };
    }

    return {
      label: (current ?? 'no name') + ' - not found',
      value: current || undefined,
      imgUrl: '',
      hideText: hideTextValue,
    };
  }

  getDataSourceOptions() {
    const { tracing, metrics, mixed, dashboard, variables, annotations, pluginId } = this.props;
    const options = this.dataSourceSrv
      // @ts-ignore
      .getList({
        tracing,
        metrics,
        dashboard,
        mixed,
        variables,
        annotations,
        pluginId,
      })
      .map((ds) => ({
        value: ds.name,
        label: `${ds.name}${ds.isDefault ? ' (default)' : ''}`,
        imgUrl: ds.meta.info.logos.small,
        meta: ds.meta,
      }));

    return options;
  }

  render() {
    const { autoFocus, onBlur, openMenuOnFocus, placeholder } = this.props;
    const { error } = this.state;
    const options = this.getDataSourceOptions();
    const value = this.getCurrentValue();

    return (
      <div aria-label={selectors.components.DataSourcePicker.container}>
        <Select
          className="ds-picker select-container"
          isMulti={false}
          isClearable={false}
          backspaceRemovesValue={false}
          onChange={this.onChange}
          options={options}
          autoFocus={autoFocus}
          onBlur={onBlur}
          openMenuOnFocus={openMenuOnFocus}
          maxMenuHeight={500}
          menuPlacement="bottom"
          placeholder={placeholder}
          noOptionsMessage="No datasources found"
          value={value}
          invalid={!!error}
          getOptionLabel={(o) => {
            if (o.meta && isUnsignedPluginSignature(o.meta.signature) && o !== value) {
              return (
                <HorizontalGroup align="center" justify="space-between">
                  <span>{o.label}</span> <PluginSignatureBadge status={o.meta.signature} />
                </HorizontalGroup>
              );
            }
            return o.label || '';
          }}
        />
      </div>
    );
  }
}
