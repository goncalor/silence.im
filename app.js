var express = require('express'),
	i18n = require('i18n'),
	request = require('request'),
	commit = null,
	moment = require('moment'),
	fs = require('fs'),
	async = require('async');

var app = express();

i18n.configure({
	locales:['en'],
	defaultLocale: 'en',
	directory: __dirname + '/locales',
	updateFiles: false
});

app.use(i18n.init);

app.use(express.static(__dirname + '/assets'));
app.set('view engine', 'ejs');

updateCache = function(cb){
	async.parallel({
		details: function(callback){
			request('https://api.github.com/repos/SilenceIM/Silence', {timeout: parseInt(process.env.TIMEOUT) || 2000, headers: {'User-Agent': 'Silence Website'}}, function (err, res) {
				if (err || typeof res == 'undefined' || typeof res.statusCode == 'undefined' || res.statusCode != 200) return callback(true);
				fs.writeFile('./cache-details.json', res.body, function (err) {
					if (err) return callback("Cannot write cache-details.json");
					return callback(null, JSON.parse(res.body));
				});
			});
		},
		commits: function(callback){
			request('https://api.github.com/repos/SilenceIM/Silence/commits', {timeout: parseInt(process.env.TIMEOUT) || 2000, headers: {'User-Agent': 'Silence Website'}}, function (err, res) {
				if (err || typeof res == 'undefined' || typeof res.statusCode == 'undefined' || res.statusCode != 200) return callback(true);
				fs.writeFile('./cache-commits.json', res.body, function (err) {
					if (err) return callback("Cannot write cache-commits.json");
					return callback(null, JSON.parse(res.body));
				});
			});
		}
	}, function(err, json){
		return cb(err, json);
	});
};

getCache = function(cb){
	async.parallel({
		commits: function(callback){
			fs.readFile('./cache-commits.json', function (err, data) {
				if (err) return callback(err);
				return callback(null, JSON.parse(data));
			});
		},
		details: function(callback){
			fs.readFile('./cache-details.json', function (err, data) {
				if (err) return callback(err);
				return callback(null, JSON.parse(data));
			});
		}
	}, function(err, json){
		return cb(err, json);
	})
};

getCacheTime = function(callback){
	fs.stat('./cache-commits.json', function(err, stats){
		if (err) return callback(err);
		return callback(null, Math.floor((new Date().getTime()-stats.mtime.getTime())/1000/60));
	});
};

getData = function(callback){
	getCacheTime(function(err, time){
		var cache = parseInt(process.env.CACHE) || 5;
		if (err || time >= cache){
			updateCache(function(err, json){
				console.log('Updating cache...');
				return callback(err, json);
			});
		} else {
			getCache(function(err, json){
				console.log('Using cache...');
				return callback(err, json);
			});
		}
	});
};

app.get('/', function (req, res) {

	moment.locale(res.locale);

	getData(function(err, json){
		if (err) console.log(err);
		if (!err){
			commit = {};
			commit.message = json.commits[0].commit.message.split('\n')[0];
			commit.date = moment(json.commits[0].commit.author.date).fromNow();
			commit.author = json.commits[0].author.login;
			commit.link = 'https://github.com/SilenceIM/Silence/commit/'+json.commits[0].sha;
		}
		return res.render('index', {req: req, res: res, commit: commit, github: json.details});
	});
})

var server = app.listen(parseInt(process.env.PORT) || 3000, function () {
	console.log('App listening at http://%s:%s', server.address().address, server.address().port);
})
