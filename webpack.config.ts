import CopyWebpackPlugin from 'copy-webpack-plugin';
import grafanaConfig, { type Env } from './.config/webpack/webpack.config.ts';

export default async function config(env: Env) {
  const base = await grafanaConfig(env);
  base.plugins?.push(
    new CopyWebpackPlugin({
      patterns: [
        { from: '../pkg/schema/dsconfig.json', to: 'schema/dsconfig.json' },
        { from: '../pkg/schema/schema.gen.json', to: 'schema/v0alpha1.json' },
        { from: '../pkg/schema/settings.gen.json', to: 'schema/v0alpha1/settings.json' },
        { from: '../pkg/schema/settings.examples.gen.json', to: 'schema/v0alpha1/settings.examples.json' },
      ],
    })
  );
  return base;
}
