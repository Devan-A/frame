const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return [
    {
      name: 'controller',
      mode: argv.mode,
      entry: './src/plugin/controller.ts',
      output: {
        filename: 'controller.js',
        path: path.resolve(__dirname, 'dist'),
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
          },
        ],
      },
      resolve: {
        extensions: ['.tsx', '.ts', '.js'],
      },
      devtool: isProduction ? false : 'inline-source-map',
    },
    {
      name: 'ui',
      mode: argv.mode,
      entry: './src/ui/main.tsx',
      output: {
        filename: 'ui.js',
        path: path.resolve(__dirname, 'dist'),
        clean: false,
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
          },
          {
            test: /\.css$/,
            use: [
              'style-loader',
              'css-loader',
              'postcss-loader',
            ],
          },
        ],
      },
      resolve: {
        extensions: ['.tsx', '.ts', '.js'],
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: './src/ui/index.html',
          filename: 'index.html',
          inject: 'body',
          inlineSource: '.(js|css)$',
        }),
        new HtmlInlineScriptPlugin(),
      ],
      devtool: isProduction ? false : 'inline-source-map',
    },
  ];
};
