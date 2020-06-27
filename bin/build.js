const fs            = require('fs');
const path          = require('path');
const yaml          = require('js-yaml');

const pug           = require('pug');

const coffee        = require('coffeescript');
const bundle        = require('bundle-js');

const stylus        = require('stylus');

const winston       = require('winston');
const { config } = require('process');

const __basedir     = path.join(__dirname, '/..');
const ID            = [...((new Date()).getTime().toString(36) + Math.random().toString(36).slice(2)).matchAll(/.{4}/g)].map(el => el[0]).join('-').toUpperCase();
const CONFIG        = yaml.load(fs.readFileSync(path.join(__basedir, '/config.yaml'), 'utf8'));

const logger        = winston.createLogger({
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(__basedir, CONFIG.dir.logs, ID + '.log')
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
            fs.rmdirSync(path.join(__basedir, CONFIG.dir.output.base, file),{recursive: true});
            logger.info(`Removing directory ${file} and all it's contents`);
        } else {
            fs.unlinkSync(path.join(__basedir, CONFIG.dir.output.base, file),{recursive: true});
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

fs.writeFileSync(path.join(__basedir, CONFIG.dir.output.base, 'robots.txt'), robots);
logger.info(`Written robots.txt`);