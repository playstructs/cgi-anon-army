// Builds structs-webapp's client (the structs-webapp submodule) as Anon Army's
// static site, anons.structs.zone. structs-webapp's own webpack config is the
// starting point, so its entry, resolution, loaders and plugins follow
// upstream; this file only adds the Anon Army overlay (anon/), the rendered
// page and the static files, and points the output at dist/.
const fs = require('node:fs');
const path = require('node:path');
const webpack = require('webpack');
const {UPSTREAM_SRC} = require('./anon/overlay.cjs');

const upstreamConfigFile = path.join(UPSTREAM_SRC, 'webpack.config.js');
if (!fs.existsSync(upstreamConfigFile)) {
  throw new Error('structs-webapp is missing: run `git submodule update --init`');
}

// The guild this site serves, Anon Army, fixed: never looked up, nor set per
// build (anon/runtime/guild.js). Its services are read from its guild.json,
// the endpoint it set on chain, through the chain's public node.
const GUILD_ID = '0-19';
const DEFAULT_LCD = 'https://public.testnet.structs.network';
// Used only when the guild's guild.json can't be read and none was read before.
const FALLBACK = {
  api: 'https://beta.playstructs.com/api',
  grass: 'wss://beta.playstructs.com:1443',
  chainWs: 'wss://public.testnet.structs.network:26657',
};

// The Anon pictures players choose from (anon/make_pfps.py makes them), served
// at /anon/pfp/. They are many (2,200): served from disk in development and
// copied into dist/ after a build, rather than passed through webpack.
const PFP_DIR = path.join(__dirname, 'anon/pfp');
const PFP_PATH = 'anon/pfp';

const PUBLIC_DIRS = [
  path.join(UPSTREAM_SRC, 'public'),
  path.join(__dirname, 'anon/public'),
];

// Upstream's public/ is served by PHP: skip the front controller, Apache's
// rules and anything a local upstream build left there (ours replace them).
const SKIP = /^(index\.php|\.htaccess|data\/|js\/(index|sectorBlitz|test|vendors-)|js\/manifest\.json|js\/workers\/)|(^|\/)\.DS_Store$/;

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(file, base, out);
    } else {
      out.push(path.relative(base, file).split(path.sep).join('/'));
    }
  }
  return out;
}

/** Emits the pages and every static file, in dev (memory) as in a build. */
class AnonSitePlugin {
  apply(compiler) {
    const {Compilation, sources, WebpackError} = compiler.webpack;
    compiler.hooks.thisCompilation.tap('AnonSitePlugin', compilation => {
      compilation.hooks.processAssets.tap({
        name: 'AnonSitePlugin', stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
      }, () => {
        // Read fresh, so the dev server picks up page.cjs and patches.cjs edits.
        delete require.cache[require.resolve('./anon/page.cjs')];
        const {renderPage, renderLeaderboard} = require('./anon/page.cjs');

        for (const dir of PUBLIC_DIRS) {
          compilation.contextDependencies.add(dir);
          for (const rel of walk(dir)) {
            if (dir === PUBLIC_DIRS[0] && SKIP.test(rel)) {
              continue;
            }
            // Served as upstream ships them: marked minimized so no minifier rewrites them.
            const asset = new sources.RawSource(fs.readFileSync(path.join(dir, rel)));
            compilation.getAsset(rel)
              ? compilation.updateAsset(rel, asset, {minimized: true})
              : compilation.emitAsset(rel, asset, {minimized: true});
          }
        }

        const bundle = name => {
          const files = compilation.entrypoints.get(name).getFiles().filter(file => file.endsWith('.js'));
          if (files.length !== 1) {
            throw new Error(`Expected one JavaScript bundle for ${name}`);
          }
          return files[0];
        };
        const emitPages = ({pages, stale, dependencies}) => {
          dependencies.forEach(file => compilation.fileDependencies.add(file));
          stale.forEach(message => compilation.warnings.push(new WebpackError(`anon: ${message}`)));
          for (const [file, html] of Object.entries(pages)) {
            compilation.emitAsset(file, new sources.RawSource(html), {minimized: true});
          }
        };
        compilation.fileDependencies.add(path.join(__dirname, 'anon/patches.cjs'));
        const {html, ...game} = renderPage(bundle('index'));
        emitPages({pages: {'index.html': html}, ...game});
        // The public Sector Blitz leaderboard, at /sector-blitz and /sector-blitz/<sector>.
        emitPages(renderLeaderboard(bundle('sectorBlitz')));
      });
    });
  }
}

/** Copies the Anon pictures into a build's output (not the dev server's). */
class AnonPfpPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tapPromise('AnonPfpPlugin', async compilation => {
      if (!fs.existsSync(PFP_DIR)) {
        compilation.errors.push(new compiler.webpack.WebpackError('anon: anon/pfp is missing: run anon/make_pfps.py'));
        return;
      }
      await fs.promises.cp(PFP_DIR, path.join(compiler.outputPath, PFP_PATH), {recursive: true});
    });
  }
}

module.exports = (env, argv) => {
  const upstream = require(upstreamConfigFile);
  const config = {
    guildId: GUILD_ID,
    lcd: process.env.ANON_LCD_URL || DEFAULT_LCD,
    // Set, these override what the guild publishes.
    api: (process.env.ANON_GUILD_API || '').replace(/\/+$/, ''),
    grass: process.env.ANON_GRASS_URL || '',
    chainWs: process.env.ANON_CHAIN_WS || '',
    fallback: FALLBACK,
  };

  const plugins = upstream.plugins
    .filter(plugin => plugin.constructor.name !== 'AssetManifestPlugin')
    // Rebuilt on this webpack: upstream's copy comes from its own node_modules.
    .map(plugin => plugin.constructor.name === 'ProvidePlugin'
      ? new webpack.ProvidePlugin(plugin.definitions)
      : plugin);

  return {
    ...upstream,
    context: UPSTREAM_SRC,
    // The game and the public Sector Blitz leaderboard: upstream's test bundle is not part of this site.
    entry: {
      index: [path.join(__dirname, 'anon/runtime/index.js'), path.join(UPSTREAM_SRC, 'js/index.js')],
      sectorBlitz: [path.join(__dirname, 'anon/runtime/index.js'), path.join(UPSTREAM_SRC, 'js/sector_blitz.js')],
    },
    output: {
      ...upstream.output,
      path: path.resolve(__dirname, 'dist'),
      filename: 'js/' + upstream.output.filename,
      chunkFilename: 'js/' + upstream.output.chunkFilename,
      publicPath: '/',
      clean: true,
    },
    module: {
      ...upstream.module,
      rules: [
        {
          test: /\.js$/,
          include: path.join(UPSTREAM_SRC, 'js'),
          exclude: path.join(UPSTREAM_SRC, 'js/ts'),
          enforce: 'pre',
          loader: path.join(__dirname, 'anon/loader.cjs'),
        },
        ...upstream.module.rules,
      ],
    },
    plugins: [
      ...plugins,
      new webpack.DefinePlugin({
        __ANON_CONFIG__: JSON.stringify(config),
      }),
      new AnonSitePlugin(),
      ...(env.WEBPACK_SERVE ? [] : [new AnonPfpPlugin()]),
    ],
    performance: {hints: false},
    devServer: {
      port: 5205,
      static: {directory: PFP_DIR, publicPath: `/${PFP_PATH}`, watch: false},
      hot: false,
      liveReload: true,
      client: {overlay: {errors: true, warnings: false}},
    },
  };
};

module.exports.GUILD_ID = GUILD_ID;
