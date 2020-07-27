const express       = require('express');
const fs            = require('fs');
const path          = require('path');
const yaml          = require('js-yaml');

const __basedir     = path.join(__dirname, '/..');
const CONFIG        = yaml.load(fs.readFileSync(path.join(__basedir, '/config.yaml'), 'utf8'));

var app = express();
app.use(express.static(path.join(__basedir, CONFIG.dir.output.base)));
app.listen(CONFIG.watch.server.port);