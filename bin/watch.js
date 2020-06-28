const fs            = require('fs');
const path          = require('path');
const yaml          = require('js-yaml');

const pug           = require('pug');

const coffee        = require('coffeescript');
const bundle        = require('bundle-js');

const stylus        = require('stylus');

const child_process = require('child_process');

const winston       = require('winston');

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

// Build assets
logger.info(`Starting asset watcher`);

logger.info(`Watching for video files`);
let video_files = fs.readdirSync(path.join(__basedir, CONFIG.dir.assets.videos));
for(let video of video_files) {
    logger.info(`Found ${video}`);
    
    logger.info(`Initial compression of ${video}`);
    child_process.execFileSync('ffmpeg', [
        '-i', path.join(__basedir, CONFIG.dir.assets.videos, video),
        '-vf', `scale='min(${CONFIG.video_options.scaling.width},iw)':'min(${CONFIG.video_options.scaling.height},ih)':force_original_aspect_ratio=decrease`,
        '-vcodec', 'libx265',
        '-crf', '28',
        path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos, video)
    ])
    logger.info(`Initial compression of ${video} done`);

    if(CONFIG.video_options.poster.generate) {
        logger.info(`Initial generation poster for ${video}`);
        child_process.execFileSync('ffmpeg', [
            '-i', path.join(__basedir, CONFIG.dir.assets.videos, video),
            '-vf', `scale='min(${CONFIG.video_options.scaling.width},iw)':'min(${CONFIG.video_options.scaling.height},ih)':force_original_aspect_ratio=decrease`,
            '-vframes', '1',
            path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos, path.basename(video) + CONFIG.video_options.poster.suffix + '.jpg')
        ])
        logger.info(`Poster for ${video} generated`);
    }

    logger.info(`Attaching watch to ${video}`);
    fs.watch(path.join(__basedir, CONFIG.dir.assets.videos, video), (eventType, filename) => {
        if(eventType == 'change') {
            logger.info(`${filename} changed recompressing`);
            child_process.execFile('ffmpeg', [
                '-i', path.join(__basedir, CONFIG.dir.assets.videos, filename),
                '-vf', `scale='min(${CONFIG.video_options.scaling.width},iw)':'min(${CONFIG.video_options.scaling.height},ih)':force_original_aspect_ratio=decrease`,
                '-vcodec', 'libx265',
                '-crf', '28',
                '-y', path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos, filename)
            ], (error, stdout, stderr) => {
                if (error) {
                    logger.info(`${filename} ERROR: ${error.message}`);
                } else {
                    logger.info(`${filename} recompressed`);

                    if(CONFIG.video_options.poster.generate) {
                        logger.info(`regenerating poster for ${filename}`);
                        child_process.execFile('ffmpeg', [
                            '-i', path.join(__basedir, CONFIG.dir.assets.videos, filename),
                            '-vf', `scale='min(${CONFIG.video_options.scaling.width},iw)':'min(${CONFIG.video_options.scaling.height},ih)':force_original_aspect_ratio=decrease`,
                            '-vframes', '1',
                            '-y', path.join(__basedir, CONFIG.dir.output.base, CONFIG.dir.output.videos, path.basename(filename) + CONFIG.video_options.poster.suffix + '.jpg')
                        ], (error, stdout, stderr) => {
                            if (error) {
                                logger.info(`${filename} ERROR: ${error.message}`);
                            } else {
                                logger.info(`${filename} poster regenerated`);
                            }
                        });
                    }
                }
            })
        }
    });
    logger.info(`Attached watch to ${video}`);
}

logger.info(`Attaching watch to video folder ${path.join(__basedir, CONFIG.dir.assets.videos)}`);
fs.watch(path.join(__basedir, CONFIG.dir.assets.videos), (eventType, filename) => {
    console.log(eventType, filename);
});
logger.info(`Video folder ${path.join(__basedir, CONFIG.dir.assets.videos)} being watched for new videos`);

logger.info(`Video files being watched`);