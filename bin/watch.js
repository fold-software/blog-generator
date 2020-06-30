const chokidar      = require('chokidar');
const express       = require('express');
const http          = require('http');
const socket_io     = require('socket.io');
const cheerio       = require('cheerio');

const fs            = require('fs');
const path          = require('path');
const yaml          = require('js-yaml');

const pug           = require('pug');

const coffee        = require('coffeescript');
const uglify        = require('uglify-js');

const stylus        = require('stylus');
const nib           = require('nib');

const SVGO          = require('svgo-sync');
const sharp         = require('sharp');

const winston       = require('winston');
const child_process = require('child_process');

const __basedir     = path.join(__dirname, '/..');
const ID            = [...((new Date()).getTime().toString(36) + Math.random().toString(36).slice(2)).matchAll(/.{4}/g)].map(el => el[0]).join('-').toUpperCase();
const CONFIG        = yaml.load(fs.readFileSync(path.join(__basedir, '/config.yaml'), 'utf8'));

const logger        = winston.createLogger({
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(__basedir, CONFIG.dir.logs, 'watch-' + ID + '.log')
        }),
    ],
});

logger.info(`Starting log execution id: ${ID}`);
logger.info(`Configuration parameters: \n ${JSON.stringify(CONFIG)}`);

// Cleaning and building dist structure
logger.info(`Cleanning dist directory ${CONFIG.dir.output.base}`);
let files = fs.readdirSync(path.join(__basedir, CONFIG.dir.output.base));
for (const file of files) {
    if(file != '.git') {
        if (fs.lstatSync(path.join(__basedir, CONFIG.dir.output.base, file)).isDirectory()) {
            fs.rmdirSync(path.join(__basedir, CONFIG.dir.output.base, file), {recursive: true});
            logger.info(`Removing directory ${file} and all it's contents`);
        } else {
            fs.unlinkSync(path.join(__basedir, CONFIG.dir.output.base, file));
            logger.info(`Removing file ${file}`);
        }
    }
}

logger.info(`Dist directory clean ${CONFIG.dir.output.base}`);

logger.info(`Rebuilding dist directory structure`);
if(!fs.existsSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.css))) fs.mkdirSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.css));
if(!fs.existsSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.javascript))) fs.mkdirSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.javascript));
if(!fs.existsSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.images))) fs.mkdirSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.images));
if(!fs.existsSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos))) fs.mkdirSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos));
if(!fs.existsSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.fonts))) fs.mkdirSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.fonts));
logger.info(`Dist directory structure done`);

// Build non-watched files
logger.info(`Starting static files`);

fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, 'CNAME'), CONFIG.cname);
logger.info(`Written CNAME`);

logger.info(`Generating sitemap.xml`);
let sitemap = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'

logger.info(`Adding static pages to sitemap.xml`);
for (let page of CONFIG.pages.static) {
    if(page.sitemap) {
        logger.info(`Adding page ${page.route}.html to sitemap.xml`);
        sitemap += '<url>'
        
        if(page.sitemap.canonical !== undefined) sitemap += `<loc>https://www.fold.com.br/${page.sitemap.canonical}</loc>`
        else sitemap += `<loc>https://www.fold.com.br/${page.route}.html</loc>`

        const modified = fs.statSync(path.join(__basedir, CONFIG.dir.preprocessed.pages, page.file)).mtime;
        sitemap += `<lastmod>${modified.getFullYear()}-${("00" + (modified.getMonth() + 1)).slice(-2)}-${("00" + modified.getDate()).slice(-2)}</lastmod>`

        if(page.sitemap.frequency !== undefined) sitemap += `<changefreq>${page.sitemap.frequency}</changefreq>`
        if(page.sitemap.priority !== undefined) sitemap += `<priority>${page.sitemap.priority}</priority>`

        sitemap += '</url>'
        logger.info(`Page ${page.route}.html added to sitemap.xml`);
    }
}
logger.info(`Generated static pages on sitemap.xml`);

sitemap += '</urlset>'
logger.info(`Generated sitemap.xml`);

fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, 'sitemap.xml'), sitemap);
logger.info(`Written sitemap.xml`);

logger.info(`Generating robots.txt`);
robots = 'User-agent: *';
for(let line of CONFIG.robots.disallow) {
    robots += '\nDisallow: ' + line;
    logger.info(`Added disallow rule for ${line}`);
}
for(let line of CONFIG.robots.allow) {
    robots += '\nAllow: ' + line;
    logger.info(`Added allow rule for ${line}`);
}
robots += '\nsitemap: https://fold.com.br/sitemap.xml'

fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, 'robots.txt'), robots);
logger.info(`Written robots.txt`);

logger.info(`Copying favicon.ico`);
fs.copyFileSync(path.join(__basedir, CONFIG.favicon.input), path.join(__basedir, CONFIG.dir.output.base, CONFIG.favicon.output));
logger.info(`Copied favicon.ico`);

logger.info(`Finished static files`);

// Live server
logger.info(`Configuring live-server`);

var app = express();
var server = http.createServer(app);
var io = socket_io.listen(server);

logger.info(`Attatching route`);
app.use('*', function(req, res) {
    logger.info(`Request on ${req.originalUrl}`);

    let file = path.join(__basedir, CONFIG.dir.output.base, req.originalUrl);
    if (fs.lstatSync(file).isDirectory()) file = path.join(file, 'index.html');

    if(path.extname(file) == '.html') {
        logger.info(`Injecting live-reload code on ${file}`);

        let html = fs.readFileSync(file, 'utf8');
        let $ = cheerio.load(html);

        let scriptNode = '<script src="/socket.io/socket.io.js"></script>';
        $('body').append(scriptNode);

        scriptNode = `<script>
            let sources = ["${req.originalUrl}", "${req.originalUrl + 'index.html'}"];
            sources = sources.concat(sources, u('video').nodes.map((el) => u(el).attr('poster')));
            sources = sources.concat(sources, u('img, video').nodes.map((el) => u(el).attr('src')));
            sources = sources.concat(sources, u('link[rel="stylesheet"]').nodes.map((el) => u(el).attr('href')));
            sources = sources.concat(sources, u('script').nodes.map((el) => u(el).attr('src')).filter(el => el !== null));
            sources = sources.concat(sources, u('*').nodes.map((el) => getComputedStyle(el, false).backgroundImage).filter(el => el != 'none').map(el => el.slice( 4, -1 ).replace(/['"]/g, "").replace(location.origin,'')));

            var socket = io();
            socket.on('update', function(url) {
                if(url.charAt(0) != '/') url = '/' + url;

                if(sources.includes(url)) location.reload(true);
            });
        </script>`;

        $('body').append(scriptNode);

        res.send($.html());
        return;
    } else {
        res.sendFile(file);
        return;
    }
});
logger.info(`Route attached`);

server.listen(CONFIG.watch.server.port);
logger.info(`Live-server listening on http://localhost:${CONFIG.watch.server.port}`);

// Build assets
logger.info(`Starting asset watching`);

logger.info(`Watching for video and posters`);
function build_video(file) {
    let video = path.relative(path.join(__basedir, CONFIG.dir.assets.videos), file);

    logger.info(`Compressing ${video}`);
    child_process.spawn('ffmpeg', [
        '-i', path.join(__basedir, CONFIG.dir.assets.videos, video),
        '-vf', `scale='min(${CONFIG.video_options.scaling.width},iw)':'min(${CONFIG.video_options.scaling.height},ih)':force_original_aspect_ratio=decrease`,
        '-vcodec', 'libx264',
        '-crf', '23',
        '-acodec', 'aac',
        '-strict',
        '-2',
        path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos, video)
    ]).on('close', () => {
        logger.info(`${video} compressed`);
        io.emit('update', CONFIG.dir.output.videos + video);
    })

    if(CONFIG.video_options.poster.generate) {
        logger.info(`Generating poster for ${video}`);
        child_process.spawn('ffmpeg', [
            '-i', path.join(__basedir, CONFIG.dir.assets.videos, video),
            '-vf', `scale='min(${CONFIG.video_options.scaling.width},iw)':'min(${CONFIG.video_options.scaling.height},ih)':force_original_aspect_ratio=decrease`,
            '-vframes', '1',
            path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos, video.split('.').slice(0, -1).join('.') + CONFIG.video_options.poster.suffix + '.jpg')
        ]).on('close', () => {
            logger.info(`Poster for ${video} generated`);
            io.emit('update', CONFIG.dir.output.videos + video.split('.').slice(0, -1).join('.') + CONFIG.video_options.poster.suffix + '.jpg');
        })
        
    }
}

chokidar.watch(path.join(__basedir, CONFIG.dir.assets.videos))
    .on('add', build_video)
    .on('change', build_video)
    .on('unlink', (file) => {
        let video = path.relative(path.join(__basedir, CONFIG.dir.assets.videos), file);
        logger.info(`${video} deleted`);

        fs.unlink(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos, video), () => {
            io.emit('update', CONFIG.dir.output.videos + video)
        })

        if(CONFIG.video_options.poster.generate)
            fs.unlink(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos, video), () => {
                io.emit('update', CONFIG.dir.output.videos + video.split('.').slice(0, -1).join('.') + CONFIG.video_options.poster.suffix + '.jpg');
            })
    })


logger.info(`Watching for images`);
let svgo_instance = new SVGO({ plugins: [
    { cleanupAttrs: true }, { inlineStyles: true }, { removeDoctype: true },
    { removeXMLProcInst: true }, { removeComments: true }, { removeMetadata: true },
    { removeTitle: true }, { removeDesc: true }, { removeUselessDefs: true },
    { removeEditorsNSData: true }, { removeEmptyAttrs: true }, { removeHiddenElems: true },
    { removeEmptyText: true }, { removeEmptyContainers: true }, { cleanupEnableBackground: true },
    { convertStyleToAttrs: true }, { convertColors: true }, { convertPathData: true },
    { convertTransform: true }, { removeUnknownsAndDefaults: true }, { removeNonInheritableGroupAttrs: true },
    { removeUselessStrokeAndFill: true }, { removeUnusedNS: true }, { cleanupIDs: true },
    { cleanupNumericValues: true }, { moveElemsAttrsToGroup: true }, { collapseGroups: true },
    { mergePaths: true }, { convertShapeToPath: true }, { removeDimensions: true }
]});

function build_image(file) {
    let image = path.relative(path.join(__basedir, CONFIG.dir.assets.images), file);

    logger.info(`Compressing ${image}`);
    if (path.extname(image) == '.svg' || path.extname(image) == '.svgz') {
        let svg = fs.readFileSync(path.join(__basedir, CONFIG.dir.assets.images, image));
        svg = svgo_instance.optimizeSync(svg, {path: path.join(__basedir, CONFIG.dir.assets.images, image)});
        fs.writeFile(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.images, image), svg.data, () => {
            logger.info(`${image} Compressed`);
            io.emit('update', CONFIG.dir.output.images + image);
        });
    } else {
        sharp(fs.readFileSync(path.join(__basedir, CONFIG.dir.assets.images, image)))
            .resize(CONFIG.image_options.scaling.width, CONFIG.image_options.scaling.height, {fit: sharp.fit.inside, withoutEnlargement: true})
            .toFormat(CONFIG.image_options.format.filetype, CONFIG.image_options.format.options)
            .toFile(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.images, image.split('.').slice(0, -1).join('.') + CONFIG.image_options.format.extension))
            .then(() => {
                logger.info(`${image} compressed`);
                io.emit('update', CONFIG.dir.output.images + image.split('.').slice(0, -1).join('.') + CONFIG.image_options.format.extension);
            })
    }
}

chokidar.watch(path.join(__basedir, CONFIG.dir.assets.images))
    .on('add', build_image)
    .on('change', build_image)
    .on('unlink', (file) => {
        let image = path.relative(path.join(__basedir, CONFIG.dir.assets.images), file);
        logger.info(`${image} deleted`);

        if (path.extname(image) == '.svg' || path.extname(image) == '.svgz') {
            fs.unlink(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.images, image), () => {
                io.emit('update', CONFIG.dir.output.images + image)
            })
        } else {
            fs.unlink(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.images, image.split('.').slice(0, -1).join('.') + CONFIG.image_options.format.extension), () => {
                io.emit('update', CONFIG.dir.output.images + image.split('.').slice(0, -1).join('.') + CONFIG.image_options.format.extension)
            })
        } 
    })

logger.info(`Watching for fonts`);
function build_font(file){
    let font = path.relative(path.join(__basedir, CONFIG.dir.assets.fonts), file);
    logger.info(`Copying ${font}`);
    fs.copyFile(path.join(__basedir, CONFIG.dir.assets.fonts, font), path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.fonts, font), () => {
        logger.info(`${font} copied`);
        io.emit('update', CONFIG.dir.output.fonts + font);
    });
}

chokidar.watch(path.join(__basedir, CONFIG.dir.assets.fonts))
    .on('add', build_font)
    .on('change', build_font)
    .on('unlink', (file) => {
        let font = path.relative(path.join(__basedir, CONFIG.dir.assets.fonts), file);
        logger.info(`${font} deleted`);
        fs.unlink(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.fonts, font), () => {
            io.emit('update', CONFIG.dir.output.fonts + font)
        })
    })

logger.info(`All assets watchers attached`);


// Compiling preprocessed files
logger.info(`Starting preprocessed watching`);

logger.info(`Watching for stylesheets`);
function build_stylesheets(file) {
    let style = path.relative(path.join(__basedir, CONFIG.dir.preprocessed.styling), file);

    logger.info(`Compiling ${style}`);
    let styl = fs.readFileSync(path.join(__basedir, CONFIG.dir.preprocessed.styling, style));
    let css = stylus(styl.toString())
        .set('filename', path.join(__basedir, CONFIG.dir.preprocessed.styling, style))
        .set('compress', true)
        .include(path.join(__basedir, CONFIG.dir.preprocessed.styling))
        .use(nib())
        .import('nib')
    
    for (let key in CONFIG.data) {
        if (CONFIG.data.hasOwnProperty(key)) {
            let value = CONFIG.data[key];
            css.define(key, value);
        }
    }

    fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.css, style.split('.').slice(0, -1).join('.') + '.css'), css.render());
    
    logger.info(`${style} compiled`);
    io.emit('update', CONFIG.dir.output.css + style.split('.').slice(0, -1).join('.') + '.css');
}

chokidar.watch(path.join(__basedir, CONFIG.dir.preprocessed.styling))
    .on('add', build_stylesheets)
    .on('change', build_stylesheets)
    .on('unlink', (file) => {
        let style = path.relative(path.join(__basedir, CONFIG.dir.preprocessed.styling), file);
        logger.info(`${style} deleted`);
        fs.unlink(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.css, style.split('.').slice(0, -1).join('.') + '.css'), () => {
            io.emit('update', CONFIG.dir.output.css + style.split('.').slice(0, -1).join('.') + '.css')
        })
    })

logger.info(`Watching for scripts`);
function build_scripts(file) {
    let script = path.relative(path.join(__basedir, CONFIG.dir.preprocessed.scripts), file);

    logger.info(`Compiling ${script}`);
    let coffee_src = child_process.spawnSync('node', [
        path.join(__basedir, 'node_modules/coffee-stir/bin/cli.js'),
        path.join(__basedir, CONFIG.dir.preprocessed.scripts, script)
    ]);
    coffee_src = coffee_src.stdout.toString().split('\n').slice(0, -2).join('\n');

    for (let key in CONFIG.data) {
        if (CONFIG.data.hasOwnProperty(key))
            coffee_src = `${key} = ${JSON.stringify(CONFIG.data[key])};\n` + coffee_src;
    }
    let js_src = coffee.compile(coffee_src, {bare: true});
    let js_min = uglify.minify(js_src, {
        compress: { toplevel: true, unused: true, dead_code: true, drop_console: true },
        mangle: false
    });
    fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.javascript, script.split('.').slice(0, -1).join('.') + '.js'), js_min.code);
    
    logger.info(`${script} Compiled`);
    io.emit('update', CONFIG.dir.output.javascript + script.split('.').slice(0, -1).join('.') + '.js');
}

chokidar.watch(path.join(__basedir, CONFIG.dir.preprocessed.scripts))
    .on('add', build_scripts)
    .on('change', build_scripts)
    .on('unlink', (file) => {
        let script = path.relative(path.join(__basedir, CONFIG.dir.preprocessed.scripts), file);
        logger.info(`${script} deleted`);
        fs.unlink(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.javascript, script.split('.').slice(0, -1).join('.') + '.css'), () => {
            io.emit('update', CONFIG.dir.output.javascript + script.split('.').slice(0, -1).join('.') + '.js')
        })
    })

logger.info(`All preprocessed files watchers attached`);

// Build pages
logger.info(`Watching pages building`);

logger.info(`Watching static pages`);
for (let page of CONFIG.pages.static) {
    logger.info(`Watching page ${page.route}.html from file ${page.file}`);
    
    let routing = page.route
    let file = page.file

    let build_this_page = () => {
        logger.info(`Rebuilding page ${routing}.html from file ${file}`);
        let src = fs.readFileSync(path.join(__basedir, CONFIG.dir.preprocessed.pages, file), 'utf8');
        
        let fn = pug.compile( src, { basedir: path.join(__basedir, CONFIG.dir.preprocessed.pages), filename: path.join(__basedir, CONFIG.dir.preprocessed.pages, file) });
        let html = fn(CONFIG.data);

        fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, routing + '.html'), html);

        io.emit('update', routing + '.html');
        logger.info(`Written page to file ${page.route}.html`);
    }

    chokidar.watch(path.join(__basedir, CONFIG.dir.preprocessed.pages, page.file))
        .on('add', build_this_page)
        .on('change', build_this_page)
    
}

logger.info(`All page watchers attached`);