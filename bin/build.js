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
const deasync_p     = require('deasync-promise');
const child_process = require('child_process');

const __basedir     = path.join(__dirname, '/..');
const ID            = [...((new Date()).getTime().toString(36) + Math.random().toString(36).slice(2)).matchAll(/.{4}/g)].map(el => el[0]).join('-').toUpperCase();
const CONFIG        = yaml.load(fs.readFileSync(path.join(__basedir, '/config.yaml'), 'utf8'));

const logger        = winston.createLogger({
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(__basedir, CONFIG.dir.logs, 'build-' + ID + '.log')
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

// Build assets
logger.info(`Starting asset building`);

logger.info(`Compressing and generating video posters`);
let video_files = fs.readdirSync(path.join(__basedir, CONFIG.dir.assets.videos));
for(let video of video_files) {
    if (!fs.lstatSync(path.join(__basedir, CONFIG.dir.assets.videos, video)).isDirectory()) {
        logger.info(`Compressing ${video}`);
        child_process.execFileSync('ffmpeg', [
            '-i', path.join(__basedir, CONFIG.dir.assets.videos, video),
            '-vf', `scale='min(${CONFIG.video_options.scaling.width},iw)':'min(${CONFIG.video_options.scaling.height},ih)':force_original_aspect_ratio=decrease`,
            '-vcodec', 'libx265',
            '-crf', '28',
            path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos, video)
        ])
        logger.info(`${video} compressed`);

        if(CONFIG.video_options.poster.generate) {
            logger.info(`Generating poster for ${video}`);
            child_process.execFileSync('ffmpeg', [
                '-i', path.join(__basedir, CONFIG.dir.assets.videos, video),
                '-vf', `scale='min(${CONFIG.video_options.scaling.width},iw)':'min(${CONFIG.video_options.scaling.height},ih)':force_original_aspect_ratio=decrease`,
                '-vframes', '1',
                path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos, video.split('.').slice(0, -1).join('.') + CONFIG.video_options.poster.suffix + '.jpg')
            ])
            logger.info(`Poster for ${video} generated`);
        }
    }
}
logger.info(`Videos compressed and posters generated`);

logger.info(`Compressing images`);
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

let image_files = fs.readdirSync(path.join(__basedir, CONFIG.dir.assets.images));
for(let image of image_files) {
    if (!fs.lstatSync(path.join(__basedir, CONFIG.dir.assets.images, image)).isDirectory()) {
        logger.info(`Compressing ${image}`);
        if (path.extname(image) == '.svg' || path.extname(image) == '.svgz') {
            let svg = fs.readFileSync(path.join(__basedir, CONFIG.dir.assets.images, image));
            svg = svgo_instance.optimizeSync(svg, {path: path.join(__basedir, CONFIG.dir.assets.images, image)});
            fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.images, image), svg.data);
        } else {
            deasync_p(
                sharp(fs.readFileSync(path.join(__basedir, CONFIG.dir.assets.images, image)))
                    .resize(CONFIG.image_options.scaling.width, CONFIG.image_options.scaling.height, {fit: sharp.fit.inside, withoutEnlargement: true})
                    .toFormat(CONFIG.image_options.format.filetype, CONFIG.image_options.format.options)
                    .toFile(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.images, image.split('.').slice(0, -1).join('.') + CONFIG.image_options.format.extension))
            );
        }
        logger.info(`${image} Compressed`);
    }
}
logger.info(`images Compressed`);

logger.info(`Copying fonts`);
let font_files = fs.readdirSync(path.join(__basedir, CONFIG.dir.assets.fonts));
for(let font of font_files) {
    if (!fs.lstatSync(path.join(__basedir, CONFIG.dir.assets.fonts, font)).isDirectory()) {
        logger.info(`Copying ${font}`);
        fs.copyFileSync(path.join(__basedir, CONFIG.dir.assets.fonts, font), path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.fonts, font));
        logger.info(`${font} copied`);
    }
}
logger.info(`Fonts Copied`);

logger.info(`Assets built`);

// Compiling preprocessed files
logger.info(`Starting preprocessing`);

logger.info(`Preprocessing stylesheets`);
let style_files = fs.readdirSync(path.join(__basedir, CONFIG.dir.preprocessed.styling));
for(let style of style_files) {
    if (!fs.lstatSync(path.join(__basedir, CONFIG.dir.preprocessed.styling, style)).isDirectory()) {
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
        logger.info(`${style} Compiled`);
    }
}
logger.info(`Stylesheets Compiled`);

logger.info(`Preprocessing scripts`);
let script_files = fs.readdirSync(path.join(__basedir, CONFIG.dir.preprocessed.scripts));
for(let script of script_files) {
    if (!fs.lstatSync(path.join(__basedir, CONFIG.dir.preprocessed.scripts, script)).isDirectory()) {
        logger.info(`Compiling ${script}`);

        let coffee_src = child_process.spawnSync('node', [
            path.join(__basedir, 'node_modules/coffee-stir/bin/cli.js'),
            path.join(__basedir, CONFIG.dir.preprocessed.scripts, script)
        ]);
        console.log(coffee_src);
        coffee_src = coffee_src.stdout.toString().split('\n').slice(0, -1).join('\n');
        for (let key in CONFIG.data) {
            if (CONFIG.data.hasOwnProperty(key))
                coffee_src = `${key} = ${JSON.stringify(CONFIG.data[key])};\n` + coffee_src;
        }
        console.log(coffee_src);
        let js_src = coffee.compile(coffee_src);     
        console.log(js_src);
        fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.javascript, script.split('.').slice(0, -1).join('.') + '.js'), uglify.minify(js_src).code);
        logger.info(`${script} Compiled`);
    }
}
logger.info(`Scripts Compiled`);

logger.info(`Everything preprocessed`);

// Build pages
logger.info(`Starting page building`);

logger.info(`Building static pages`);
for (let page of CONFIG.pages.static) {
    logger.info(`Building page ${page.route}.html from file ${page.file}`);
    
    let src = fs.readFileSync(path.join(__basedir, CONFIG.dir.preprocessed.pages, page.file), 'utf8');
    logger.info(`Opened file contents ${page.file}`);

    let fn = pug.compile( src, { basedir: path.join(__basedir, CONFIG.dir.preprocessed.pages) });
    let html = fn(CONFIG.data);
    logger.info(`Rendered page ${page.file}`);

    fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, page.route + '.html'), html);
    logger.info(`Written page to file ${page.route}.html`);
}
logger.info(`Finished static pages`);

logger.info(`Finished page building`);

// Build other files
logger.info(`Starting final files`);

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