const fs            = require('fs');
const path          = require('path');
const yaml          = require('js-yaml');

const pug           = require('pug');
const marked        = require('marked');
const cheerio       = require('cheerio');

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
        child_process.spawnSync('ffmpeg', [
            '-i', path.join(__basedir, CONFIG.dir.assets.videos, video),
            '-vf', `scale='min(${CONFIG.video_options.scaling.width},iw)':'min(${CONFIG.video_options.scaling.height},ih)':force_original_aspect_ratio=decrease`,
            '-vcodec', 'libx264',
            '-crf', '23',
            '-acodec', 'aac',
            '-strict',
            '-2',
            path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos, video)
        ])
        logger.info(`${video} compressed`);

        if(CONFIG.video_options.poster.generate) {
            logger.info(`Generating poster for ${video}`);
            child_process.spawnSync('ffmpeg', [
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
        if (path.extname(style) == '.css') {
            logger.info(`Copying ${style}`);
            fs.copyFileSync(path.join(__basedir, CONFIG.dir.preprocessed.styling, style), path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.css, style));
            logger.info(`${style} copied`);
        } else {
            logger.info(`Compiling ${style}`);
            let styl = fs.readFileSync(path.join(__basedir, CONFIG.dir.preprocessed.styling, style));
            let css = stylus(styl.toString())
                .set('filename', path.join(__basedir, CONFIG.dir.preprocessed.styling, style))
                .set('compress', true)
                .include(path.join(__basedir, CONFIG.dir.preprocessed.styling))
                .use(nib())
                .import('nib')

            fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.css, style.split('.').slice(0, -1).join('.') + '.css'), css.render());
            logger.info(`${style} Compiled`);
        }
    }
}
logger.info(`Stylesheets Compiled`);

logger.info(`Preprocessing scripts`);
let script_files = fs.readdirSync(path.join(__basedir, CONFIG.dir.preprocessed.scripts));
for(let script of script_files) {
    if (!fs.lstatSync(path.join(__basedir, CONFIG.dir.preprocessed.scripts, script)).isDirectory()) {
        if (path.extname(script) == '.js') {
            logger.info(`Copying ${script}`);
            fs.copyFileSync(path.join(__basedir, CONFIG.dir.preprocessed.scripts, script), path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.javascript, script));
            logger.info(`${script} copied`);
        } else {
            logger.info(`Compiling ${script}`);

            let coffee_src = child_process.spawnSync('node', [
                path.join(__basedir, 'node_modules/coffee-stir/bin/cli.js'),
                path.join(__basedir, CONFIG.dir.preprocessed.scripts, script)
            ]);
            coffee_src = coffee_src.stdout.toString().split('\n').slice(0, -2).join('\n');

            let js_src = coffee.compile(coffee_src, {bare: true});
            logger.info(`${script} Compiled`);

            logger.info(`Minifying ${script}`);

            let js_min = uglify.minify(js_src, {
                compress: { unused: true, dead_code: true, drop_console: true },
                mangle: false
            });

            fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.javascript, script.split('.').slice(0, -1).join('.') + '.js'), js_min.code);
            logger.info(`${script} Minified`);
        }
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

    let fn = pug. compile( src, { basedir: path.join(__basedir, CONFIG.dir.preprocessed.pages), filename: path.join(__basedir, CONFIG.dir.preprocessed.pages, page.file) });
    let html = fn();
    logger.info(`Rendered page ${page.file}`);

    fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, page.route + '.html'), html);
    logger.info(`Written page to file ${page.route}.html`);
}
logger.info(`Finished static pages`);

logger.info(`Building blog`);
let post_template = pug.compile(
    fs.readFileSync(path.join(__basedir, CONFIG.dir.preprocessed.pages, CONFIG.pages.blog.posts.file), 'utf8')
    , {
        basedir: path.join(__basedir, CONFIG.dir.preprocessed.pages),
        filename: path.join(__basedir, CONFIG.dir.preprocessed.pages, CONFIG.pages.blog.posts.file)
    }
);

let index_template = pug.compile(
    fs.readFileSync(path.join(__basedir, CONFIG.dir.preprocessed.pages, CONFIG.pages.blog.indexing.file), 'utf8')
    , {
        basedir: path.join(__basedir, CONFIG.dir.preprocessed.pages),
        filename: path.join(__basedir, CONFIG.dir.preprocessed.pages, CONFIG.pages.blog.indexing.file)
    }
);

let full_post_list = [];

for (let category of CONFIG.pages.blog.structure.categories) {
    logger.info(`Adding ${category.name} folder`);
    if(!fs.existsSync(path.join(__basedir, CONFIG.dir.output.base, category.index.route))) fs.mkdirSync(path.join(__basedir, CONFIG.dir.output.base, category.index.route));
    if(!fs.existsSync(path.join(__basedir, CONFIG.dir.output.base, category.index.route, 'assets'))) fs.mkdirSync(path.join(__basedir, CONFIG.dir.output.base, category.index.route, 'assets'));
    logger.info(`${category.name} folder created at ${path.join(__basedir, CONFIG.dir.output.base, category.index.route)}`)

    let category_post_list = [];

    logger.info(`Building blog posts`);
    let post_folders = fs.readdirSync(path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder));
    for(let post of post_folders) {
        if (fs.lstatSync(path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder, post)).isDirectory()) {
            logger.info(`Building blog post from ${post}`);

            let post_info = yaml.load(fs.readFileSync(path.join(CONFIG.pages.blog.structure.base, category.folder, post, 'info.yaml'), 'utf8'));
            logger.info(`${post} info loaded`);

            logger.info(`Building ${post} assets`);
            let post_assets = fs.readdirSync(path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder, post, 'assets'));
            for(let asset of post_assets) {
                switch (path.extname(asset)) {
                    case '.mp4':
                        logger.info(`Compressing ${asset} as video`);
                        child_process.spawnSync('ffmpeg', [
                            '-i', path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder, post, 'assets', asset),
                            '-vf', `scale='min(${CONFIG.video_options.scaling.width},iw)':'min(${CONFIG.video_options.scaling.height},ih)':force_original_aspect_ratio=decrease`,
                            '-vcodec', 'libx264',
                            '-crf', '23',
                            '-acodec', 'aac',
                            '-strict',
                            '-2',
                            path.join(__basedir, CONFIG.dir.output.base, category.index.route, 'assets', post_info.prefix + "_" + asset)
                        ])
                        logger.info(`${asset} compressed`);

                        if(CONFIG.video_options.poster.generate) {
                            logger.info(`Generating poster for ${asset}`);
                            child_process.spawnSync('ffmpeg', [
                                '-i', path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder, post, 'assets', asset),
                                '-vf', `scale='min(${CONFIG.video_options.scaling.width},iw)':'min(${CONFIG.video_options.scaling.height},ih)':force_original_aspect_ratio=decrease`,
                                '-vframes', '1',
                                path.join(__basedir, CONFIG.dir.output.base, category.index.route, 'assets', post_info.prefix + "_" + asset.split('.').slice(0, -1).join('.') + CONFIG.video_options.poster.suffix + '.jpg')
                            ])
                            logger.info(`Poster for ${asset} generated`);
                        }
                        
                        break;
                    case '.svg': case '.svgz':
                        let svg = fs.readFileSync(path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder, post, 'assets', asset));
                        svg = svgo_instance.optimizeSync(svg, {path: path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder, post, 'assets', asset)});
                        fs.writeFileSync(path.join(__basedir,  CONFIG.dir.output.base, category.index.route, 'assets', post_info.prefix + "_" + asset), svg.data);
                        logger.info(`${asset} compressed`);
                        break;
                    case '.png': case '.jpg': case '.jpeg':
                        deasync_p(
                            sharp(fs.readFileSync(path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder, post, 'assets', asset)))
                                .resize(CONFIG.image_options.scaling.width, CONFIG.image_options.scaling.height, {fit: sharp.fit.inside, withoutEnlargement: true})
                                .toFormat(CONFIG.image_options.format.filetype, CONFIG.image_options.format.options)
                                .toFile(path.join(__basedir,  CONFIG.dir.output.base, category.index.route, 'assets', post_info.prefix + "_" + asset.split('.').slice(0, -1).join('.') + CONFIG.image_options.format.extension))
                        );
                        logger.info(`${asset} compressed`);
                        break;
                    case '.coffee':
                        let coffee_src = child_process.spawnSync('node', [
                            path.join(__basedir, 'node_modules/coffee-stir/bin/cli.js'),
                            path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder, post, 'assets', asset)
                        ]);
                        coffee_src = coffee_src.stdout.toString().split('\n').slice(0, -2).join('\n');
                
                        let js_src = coffee.compile(coffee_src, {bare: true});
                        let js_min = uglify.minify(js_src, {
                            compress: { unused: true, dead_code: true, drop_console: true },
                            mangle: false
                        });
                        fs.writeFileSync(path.join(__basedir,  CONFIG.dir.output.base, category.index.route, 'assets', post_info.prefix + "_" + asset.split('.').slice(0, -1).join('.') + '.js'), js_min.code);
                        logger.info(`${asset} Compiled`);
                        break;
                    case '.styl':
                        let styl = fs.readFileSync(path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder, post, 'assets', asset));
                        let css = stylus(styl.toString())
                            .set('filename', path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder, post, 'assets', asset))
                            .set('compress', true)
                            .include(path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder, post, 'assets/'))
                            .use(nib())
                            .import('nib')

                        fs.writeFileSync(path.join(__basedir,  CONFIG.dir.output.base, category.index.route, 'assets', post_info.prefix + "_" + asset.split('.').slice(0, -1).join('.') + '.css'), css.render());
                        logger.info(`${asset} Compiled`);
                        break;
                    default:
                        fs.copyFileSync(path.join(__basedir, CONFIG.pages.blog.structure.base, category.folder, post, 'assets', asset), path.join(__basedir,  CONFIG.dir.output.base, category.index.route, 'assets', post_info.prefix + "_" + asset));
                        logger.info(`${asset} Copied`);
                        break;
                }
            }
            logger.info(`Assets from ${post} built`);

            logger.info(`Generating post thumbnail for ${post}`);
            deasync_p(
                sharp(fs.readFileSync(path.join(CONFIG.pages.blog.structure.base, category.folder, post, 'thumbnail.jpg')))
                    .resize(CONFIG.image_options.extra.miniature.width, CONFIG.image_options.extra.miniature.height, {fit: sharp.fit.cover, withoutEnlargement: true})
                    .toFormat(CONFIG.image_options.format.filetype, CONFIG.image_options.format.options)
                    .toFile(path.join(__basedir, CONFIG.dir.output.base, category.index.route, 'assets', post_info.prefix + '_thumbnail-miniature' + CONFIG.image_options.format.extension))
            );

            deasync_p(
                sharp(fs.readFileSync(path.join(CONFIG.pages.blog.structure.base, category.folder, post, 'thumbnail.jpg')))
                    .resize(CONFIG.image_options.extra.opengraph.width, CONFIG.image_options.extra.opengraph.height, {fit: sharp.fit.cover, withoutEnlargement: true})
                    .toFormat(CONFIG.image_options.format.filetype, CONFIG.image_options.format.options)
                    .toFile(path.join(__basedir, CONFIG.dir.output.base, category.index.route, 'assets', post_info.prefix + '_open-graph' + CONFIG.image_options.format.extension))
            );

            deasync_p(
                sharp(fs.readFileSync(path.join(CONFIG.pages.blog.structure.base, category.folder, post, 'thumbnail.jpg')))
                    .resize(CONFIG.image_options.scaling.width, CONFIG.image_options.scaling.height, {fit: sharp.fit.cover, withoutEnlargement: true})
                    .toFormat(CONFIG.image_options.format.filetype, CONFIG.image_options.format.options)
                    .toFile(path.join(__basedir, CONFIG.dir.output.base, category.index.route, 'assets', post_info.prefix + '_thumbnail-fullsize' + CONFIG.image_options.format.extension))
            );
            logger.info(`${post} thumbnail generated`);

            logger.info(`Writting ${post} html`);
            let post_text = marked(fs.readFileSync(path.join(CONFIG.pages.blog.structure.base, category.folder, post, 'post.md'), 'utf8'));
            let $ = cheerio.load(post_text);

            $("img[src$='.mp4']").each((idx, el) => {
                let video_node = `<video controls>
                    <source src="/${category.index.route}/assets/${post_info.prefix}_${$(el).attr('src')}" type="video/mp4"></source>
                </video>`

                $(el).after(video_node);

                if(CONFIG.video_options.poster.generate) {
                    $(el)
                        .next()
                        .attr('poster', `/${category.index.route}/assets/${post_info.prefix}_${$(el).attr('src').split('.').slice(0, -1).join('.')}${CONFIG.video_options.poster.suffix}.jpg`)
                }

                $(el).remove();
            })

            $("img").each((idx, el) => {
                if($(el).attr('src')[0] != '/') {
                    if($(el).attr('src').split('.').slice(-1) == 'svg' || $(el).attr('src').split('.').slice(-1) == 'svgz')
                        $(el).attr('src', `/${category.index.route}/assets/${post_info.prefix}_${$(el).attr('src')}`)
                    else
                        $(el).attr('src', `/${category.index.route}/assets/${post_info.prefix}_${$(el).attr('src').split('.').slice(0, -1).join('.') + CONFIG.image_options.format.extension}`)
                }
            })

            $("script[src]").each((idx, el) => {
                if($(el).attr('src')[0] != '/') 
                    $(el).attr('src', `/${category.index.route}/assets/${post_info.prefix}_${$(el).attr('src')}`)
            })

            $("link[rel='stylesheet']").each((idx, el) => {
                if($(el).attr('href')[0] != '/') 
                    $(el).attr('href', `/${category.index.route}/assets/${post_info.prefix}_${$(el).attr('href')}`)
            })

            let post_html = post_template({
                title: post_info.title,
                slug: post_info.slug,
                date: post_info.date,
                url: category.index.route + '/' + post + '.html',
                data: post_info.data,
                text: {
                    plain: $.text(),
                    html: $.html()
                },
                thumbnail: {
                    og: '/' + category.index.route + '/assets/' + post_info.prefix + '_open-graph' + CONFIG.image_options.format.extension,
                    full: '/' + category.index.route + '/assets/' + post_info.prefix + '_thumbnail-fullsize' + CONFIG.image_options.format.extension,
                    miniature: '/' + category.index.route + '/assets/' + post_info.prefix + '_thumbnail-miniature' + CONFIG.image_options.format.extension
                },
                category: {
                    name: category.name,
                    index: category.index.generate ? ('/' + category.index.route + '/') : ('/'),
                    data: category.data
                }
            });

            fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, category.index.route, post + '.html'), post_html);
            logger.info(`Written blog post to file ${path.join(__basedir, CONFIG.dir.output.base, category.index.route, post + '.html')}`);

            post_info.thumbnail = {
                og: '/' + category.index.route + '/assets/' + post_info.prefix + '_open-graph' + CONFIG.image_options.format.extension,
                full: '/' + category.index.route + '/assets/' + post_info.prefix + '_thumbnail-fullsize' + CONFIG.image_options.format.extension,
                miniature: '/' + category.index.route + '/assets/' + post_info.prefix + '_thumbnail-miniature' + CONFIG.image_options.format.extension
            }

            post_info.category = {
                name: category.name,
                index: category.index.generate ? ('/' + category.index.route + '/') : ('/'),
                data: category.data
            }

            post_info.url = '/' + category.index.route + '/' + post + '.html'

            category_post_list.push(post_info);
        }
    }
    logger.info(`Finished blog pages`);

    if (category.index.generate) {
        logger.info(`Building blog category page`);
        category_post_list.sort((a, b) => b.date.getTime() - a.date.getTime())

        let index_html = index_template({
            name: category.name,
            route: '/' + category.index.route + '/',
            data: category.data,
            posts: category_post_list
        })
        fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, category.index.route, 'index.html'), index_html);
        logger.info(`Finished blog category page`);
    }

    full_post_list = full_post_list.concat(category_post_list);
}

logger.info(`Building blog index page`);

let index_blog = pug.compile(
    fs.readFileSync(path.join(__basedir, CONFIG.dir.preprocessed.pages, CONFIG.pages.blog.indexing.file), 'utf8')
    , {
        basedir: path.join(__basedir, CONFIG.dir.preprocessed.pages),
        filename: path.join(__basedir, CONFIG.dir.preprocessed.pages, CONFIG.pages.blog.indexing.file)
    }
);

full_post_list.sort((a, b) => b.date.getTime() - a.date.getTime())
let index_html = index_blog({
    route: '/' + CONFIG.pages.blog.indexing.route + '.html',
    data: CONFIG.pages.blog.indexing.data,
    posts: full_post_list
});

fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base,  CONFIG.pages.blog.indexing.route + '.html'), index_html);
logger.info(`Finished blog index page`);

logger.info(`Finished blog`);

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

logger.info(`Adding blog pages to sitemap.xml`);
if(CONFIG.pages.blog.indexing.sitemap) {
    logger.info(`Adding main blog index to sitemap.xml`);
    sitemap += '<url>'
    
    if(CONFIG.pages.blog.indexing.canonical !== undefined) sitemap += `<loc>https://www.fold.com.br/${CONFIG.pages.blog.indexing.canonical}</loc>`
    else sitemap += `<loc>https://www.fold.com.br/${CONFIG.pages.blog.indexing.route}.html</loc>`

    if(CONFIG.pages.blog.indexing.sitemap.frequency !== undefined) sitemap += `<changefreq>${CONFIG.pages.blog.indexing.sitemap.frequency}</changefreq>`
    if(CONFIG.pages.blog.indexing.sitemap.priority !== undefined) sitemap += `<priority>${CONFIG.pages.blog.indexing.sitemap.priority}</priority>`

    sitemap += '</url>'
    logger.info(`Main blog index added to sitemap.xml`);
}

for (let page of CONFIG.pages.blog.structure.categories) {
    if(page.sitemap) {
        logger.info(`Adding index for ${page.name} to sitemap.xml`);
        sitemap += '<url>'
        
        if(page.sitemap.canonical !== undefined) sitemap += `<loc>https://www.fold.com.br/${page.sitemap.canonical}</loc>`
        else sitemap += `<loc>https://www.fold.com.br/${page.route}.html</loc>`

        if(page.sitemap.frequency !== undefined) sitemap += `<changefreq>${page.sitemap.frequency}</changefreq>`
        if(page.sitemap.priority !== undefined) sitemap += `<priority>${page.sitemap.priority}</priority>`

        sitemap += '</url>'
        logger.info(`Index for ${page.name} added to sitemap.xml`);
    }
}

if(CONFIG.pages.blog.posts.sitemap) {
    for (let post of full_post_list) {
            logger.info(`Adding post ${post.title} to sitemap.xml`);
            sitemap += '<url>'
            sitemap += `<loc>https://www.fold.com.br${post.url}</loc>`

            if(CONFIG.pages.blog.posts.sitemap.frequency !== undefined) sitemap += `<changefreq>${CONFIG.pages.blog.posts.sitemap.frequency}</changefreq>`
            if(CONFIG.pages.blog.posts.sitemap.priority !== undefined) sitemap += `<priority>${CONFIG.pages.blog.posts.sitemap.priority}</priority>`

            sitemap += '</url>'
            logger.info(`${post.title} added to sitemap.xml`);
        }
}
logger.info(`Blog pages added on sitemap.xml`);

sitemap += '</urlset>'
logger.info(`Generated sitemap.xml`);

fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, 'sitemap.xml'), sitemap);
logger.info(`Written sitemap.xml`);

if(CONFIG.rss.generate) {
    logger.info(`Generating RSS Feed`);
    let rss = '<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel>'

    logger.info(`Adding basic info to RSS feed`);

    rss += `<title> ${CONFIG.rss.info.title} </title>` 
    rss += `<link> ${CONFIG.rss.info.link} </link>` 
    rss += `<description> ${CONFIG.rss.info.description} </description>` 

    if(CONFIG.rss.info.language !== undefined) rss += `<language> ${CONFIG.rss.info.language} </language>` 
    if(CONFIG.rss.info.category !== undefined) rss += `<category> ${CONFIG.rss.info.category} </category>` 

    rss += `<pubDate> ${(new Date()).toUTCString()} </pubDate>` 

    rss += '<image>'
    rss += `<title> ${CONFIG.rss.image.title} </title>` 
    rss += `<url> ${CONFIG.rss.info.link}/img/${CONFIG.rss.image.title} </url>` 
    rss += `<link> ${CONFIG.rss.info.link} </link>` 
    rss += '<width> 144 </width><height> 50 </height>'
    rss += '</image>' 

    logger.info(`Adding blog posts to RSS feed`);
    for (let i = 0; i < CONFIG.rss.amount && i < full_post_list.length; i++) {
        let post = full_post_list[i];

        logger.info(`Adding post ${post.title} to RSS Feed`);
        rss += '<item>'
        rss += `<title> ${CONFIG.rss.image.title} </title>` 
        rss += `<link> https://www.fold.com.br${post.url} </link    >` 
        rss += `<description> ${post.slug} </description>` 
        rss += `<pubDate> ${post.date.toUTCString()} </pubDate>` 
        rss += `<guid isPermaLink="true"> https://www.fold.com.br${post.url} </guid>`
        rss += `<source> https://www.fold.com.br/${CONFIG.rss.file} </source>` 
        rss += '</item>'
        logger.info(`${post.title} added to RSS Feed`);
    }

    sitemap += '</channel></rss>'
    logger.info(`Generated RSS feed`);

    fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, CONFIG.rss.file), rss);
    logger.info(`Written RSS feed`);
}

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