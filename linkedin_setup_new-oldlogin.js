require('dotenv').load()
var tress = require('tress');
var cheerio = require('cheerio');
var needle = require('needle')
var moment = require('moment');
var fs = require('fs');
var log = require('debug')('Info:')
var log_err = require('debug')('Error:')
var events = require('events');
var util = require('util')
var request = require('request')

log.color = 6
log_err.color = 2

webdriver = require('selenium-webdriver')
proxy = require('selenium-webdriver/proxy')
chrome= require('selenium-webdriver/chrome')
By = webdriver.By
until = webdriver.until
path = require('chromedriver').path
service = new chrome.ServiceBuilder(path).build();
chrome.setDefaultService(service)

/* Waiting timers */

var between_functions = 3000;
var between_actions = 100;
var number_of_instances = 10;

//var functions = ['geturl','privacy','details','avatar','experience','education','skillset','changepw','invitesettings','acceptinvites']
  var functions = ['geturl']

		
	botdb = fs.readFileSync('linkedin-setup-input.csv', 'utf-8')
		.split('\r\n')
		.filter(Boolean);

	console.log(botdb)
		
	botdb.forEach(function(cur,ind,arr){
		var tmp = arr[ind].split(',')
		arr[ind] = {
			proxy: tmp[0],
			port: tmp[1],
			email: tmp[2],
			name: tmp[3],
			pass: tmp[4],
			passMail: tmp[5],
			img:tmp[6],
			zip:tmp[7],
			firstname:tmp[8],
			lastname:tmp[9],
			cookies:'',
			csrf:''
		}
	})
	
	var screen = 0
	if(process.argv.indexOf('urlonly') !== -1){
		functions = []
	}
	
	companies = fs.readFileSync('linkedin-db-companies.csv', 'utf-8')
		.split('\r\n')
		.filter(Boolean);
		
	schools = fs.readFileSync('linkedin-db-edu-schools.csv', 'utf-8')
		.split('\r\n')
		.filter(Boolean);
		
	studies = fs.readFileSync('linkedin-db-edu-studies.csv', 'utf-8')
		.split('\r\n')
		.filter(Boolean);
		
	jobdates = fs.readFileSync('linkedin-db-jobdates.csv', 'utf-8')
		.split('\r\n')
		.filter(Boolean);
	
	jobtitles = fs.readFileSync('linkedin-db-jobtitles.csv', 'utf-8')
		.split('\r\n')
		.filter(Boolean);
		
	skills = fs.readFileSync('linkedin-db-skills.csv', 'utf-8')
		.split('\r\n')
		.filter(Boolean);

var bots = tress(function(bot,callback){
	
	fs.writeFile(`bot${(botdb.indexOf(bot) + 1)}.lock`, {encoding: 'utf-8'} , function (err) {
		if (err) {
			log_err(err);
		}
	})
	
	var login_tries = 0
	var login_done = false
	var tag = ''
	var mail_max = 0
	var profileLink = ''
	var errors = 0
	var called = false
	var fstart = 0
	var invites_accepted = 0

	var options = {
		compressed         : true,
		rejectUnauthorized : false,
		open_timeout: 10000,
		response_timeout: 10000,
		read_timeout: 10000,
		proxy: bot.proxy + ':' + bot.port
	}

	var options_2 = {
		compressed         : true,
		rejectUnauthorized : false,
		follow_max : 5,
		follow_set_cookies : true,
		open_timeout: 10000,
		response_timeout: 10000,
		read_timeout: 10000,
		proxy: bot.proxy + ':' + bot.port
	}

	options['headers'] = {
		'authority': 'www.linkedin.com',
		'method': 'POST',
		'path': '/uas/login-submit',
		'scheme': 'https',
		'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
		'accept-encoding': 'gzip, deflate, br',
		'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6',
		'cache-control': 'max-age=0',
		'content-type': 'application/x-www-form-urlencoded',
		'origin': 'https://www.linkedin.com',
		'referer': 'https://www.linkedin.com/',
		'upgrade-insecure-requests': '1',
		'x-compress': 'null',
		'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36'
	}
	
	log(`Logging in Bot #${botdb.indexOf(bot) + 1} - ${bot.email}`)
	writeLog(`Logging in Bot #${botdb.indexOf(bot) + 1} - ${bot.email}`,'Info:')
	login()

	function login(){
		
		login_tries++;

		var url = 'https://www.linkedin.com'

		needle.get(url, options, function(err, resp){

			if ((err == null) && resp.statusCode === 200) {
				var $ = cheerio.load(resp.body)

				var csrf = $('#loginCsrfParam-login').attr('value')
				var ck = resp.cookies

				var url = 'https://www.linkedin.com/uas/login-submit?loginSubmitSource=GUEST_HOME'

				options['cookies'] = ck

				if(options['cookies'] == undefined){
					login()
					return
				}

				needle.post(url, {session_key:bot.email,session_password:bot.pass,isJsEnabled:false,loginCsrfParam:csrf}, options, async function(err, resp){

					if ((err == null) && (resp.statusCode === 302 || resp.statusCode == 303 || resp.statusCode === 200)) {

						var $ = cheerio.load(resp.body)

						if($('#challengeContent').length !== 0){
							log_err(`Captcha! Solving for bot #${botdb.indexOf(bot) + 1} - ${bot.email}`)
							var ck = await solveCaptcha()
							if(ck !== false){
								record_cookie(ck,true)
							} else {
								log_err(`Error on login: captcha or wrong password, skipping the ${bot.email}`)
								if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
									fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
								}
								skippedBots(botdb.indexOf(bot))
								callback()
								return
							}			
						} else if($(`#idverifyUrl`).length !== 0 || $(`#pagekey-uas-account-restricted`).length !== 0 || resp.body.indexOf('href="/checkpoint/challenge/') !== -1 || (resp.headers['location'] && resp.headers['location'].indexOf('/checkpoint/challenge/') !== -1)){
							
							if(resp.body.indexOf('href="/checkpoint/challenge/') !== -1 || (resp.headers['location'] && resp.headers['location'].indexOf('/checkpoint/challenge/') !== -1)){

								var loc = resp.headers['location']

								if(loc == undefined){
									log_err(`Profile Banned! Skipping - ${bot.email} Bot #${botdb.indexOf(bot) + 1}`)
									writeLog(`Profile Banned! Skipping - ${bot.email} Bot #${botdb.indexOf(bot) + 1}`,'Error:')
									if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
										fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
									}
									skippedBots(botdb.indexOf(bot))
									callback()
									return
								}

								options.cookies['chp_token'] = resp.cookies['chp_token']

								needle.get(`https://www.linkedin.com${resp.headers['location']}`, options, async function(err, resp){

									if(!resp && !resp.body){
										log_err(`Nothing sent back for Bot #${botdb.indexOf(bot) + 1}, retrying`)
										writeLog(`Nothing sent back for Bot #${botdb.indexOf(bot) + 1}, retrying`,'Error:')
										callback()
										return
									}

									if(resp.body.indexOf('captchaV2Challenge') !== -1){
										log_err(`Captcha! Solving - ${bot.email}`)
										var ck = await solveCaptcha()
										if(ck !== false){
											record_cookie(ck,true)
											return
										} else {
											log_err(`Error on login: captcha or wrong password, skipping the ${bot.email}`)
											if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
												fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
											}
											skippedBots(botdb.indexOf(bot))
											callback()
											return
										}
									}

									var $ = cheerio.load(resp.body)
									
									var test = {
										csrfToken: $('input[name="csrfToken"]').attr('value'),
										pageInstance: $('meta[name="pageInstance"]').attr('content'),
										resendUrl: '/checkpoint/challenge/resend',
										challengeId: $('input[name="challengeId"]').attr('value'),
										language: 'en-US',
										displayTime: $('input[name="displayTime"]').attr('value'),
										challengeSource: $('input[name="challengeSource"]').attr('value'),
										requestSubmissionId: $('input[name="requestSubmissionId"]').attr('value'),
										challengeType: $('input[name="challengeType"]').attr('value'),
										challengeData: $('input[name="challengeData"]').attr('value'),
										failureRedirectUri: $('input[name="failureRedirectUri"]').attr('value'),
										pin: ''
									}

									if(test.csrfToken == undefined || test.pageInstance == undefined || test.requestSubmissionId == undefined){
										log_err(`General Error Login(or profile banned) - unknown LinkedIn error. Skipping Bot #${botdb.indexOf(bot) + 1}`)
										writeLog(`General Error Login(or profile banned) - unknown LinkedIn error. Skipping Bot #${botdb.indexOf(bot) + 1}`,'Error:')
										skippedBots(botdb.indexOf(bot))
										callback()
										return
									}

									log_err(`Pin requested for Bot #${botdb.indexOf(bot) + 1}!`)
									writeLog(`Pin requested for Bot #${botdb.indexOf(bot) + 1}!`,'Error:')

									var cnt = 0
									var pins = await mailconfirm()

									pin_submit()

									function pin_submit(){

										var obj = {
											csrfToken: $('input[name="csrfToken"]').attr('value'),
											pageInstance: $('meta[name="pageInstance"]').attr('content'),
											resendUrl: '/checkpoint/challenge/resend',
											challengeId: $('input[name="challengeId"]').attr('value'),
											language: 'en-US',
											displayTime: $('input[name="displayTime"]').attr('value'),
											challengeSource: $('input[name="challengeSource"]').attr('value'),
											requestSubmissionId: $('input[name="requestSubmissionId"]').attr('value'),
											challengeType: $('input[name="challengeType"]').attr('value'),
											challengeData: $('input[name="challengeData"]').attr('value'),
											failureRedirectUri: $('input[name="failureRedirectUri"]').attr('value'),
											pin: pins[cnt]
										}

										options['headers'] = {
											'authority': 'www.linkedin.com',
											'method': 'POST',
											'path': '/checkpoint/challenge/verify',
											'scheme': 'https',
											'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
											'accept-encoding': 'gzip, deflate, br',
											'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6',
											'cache-control': 'max-age=0',
											'content-type': 'application/x-www-form-urlencoded',
											'origin': 'https://www.linkedin.com',
											'referer': `https://www.linkedin.com${loc}`,
											'upgrade-insecure-requests': '1',
											'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36'
										}

										options.follow_max = 5
										options.follow_set_cookies = true

										needle.post(`https://www.linkedin.com/checkpoint/challenge/verify`, obj, options, async function(err, resp){

											if ((err == null) && (resp.statusCode === 200)) {
												var $ = cheerio.load(resp.body)

												fs.writeFileSync('pintry.html',resp.body,function(){})

												if(resp.body.indexOf('a href="/feed/"') == -1){
													if(resp.body.indexOf('verification') !== -1){
														cnt++
														if(cnt !== pins.length){
															pin_submit()
														} else {
															log_err(`No more pins! Skipping Bot #${botdb.indexOf(bot) + 1}`)
															writeLog(`No more pins! Skipping Bot #${botdb.indexOf(bot) + 1}`,'Error:')
															skippedBots(botdb.indexOf(bot))
															callback()
															return
														}
													} else {
														log(`Entered pin for Bot #${botdb.indexOf(bot) + 1}, logging again`)
														writeLog(`Entered pin for Bot #${botdb.indexOf(bot) + 1}, logging again`,'Info:')
														delete options.follow_max
														delete options.follow_set_cookies
														login()
														return
													}
												} else {
													log(`Entered pin for Bot #${botdb.indexOf(bot) + 1}, logging again`)
													writeLog(`Entered pin for Bot #${botdb.indexOf(bot) + 1}, logging again`,'Info:')
													delete options.follow_max
													delete options.follow_set_cookies
													login()
													return
												}
												
											} else {
												console.log(err)
												if(resp){
													console.log(resp.body)
													console.log(resp.statusCode)
													console.log(resp.headers)
													console.log('OPTIONS')
													console.log(options)
												}
												writeLog(err,'Error:')
											}
										})
									}

									return

								})


							} else {
								log_err(`Profile Banned! Skipping - ${bot.email} Bot #${botdb.indexOf(bot) + 1}`)
								writeLog(`Profile Banned! Skipping - ${bot.email} Bot #${botdb.indexOf(bot) + 1}`,'Error:')
								if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
									fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
								}
								skippedBots(botdb.indexOf(bot))
								callback()
								return
							}			
						} else if($(`#session_password-login-error`).length !== 0){
							log_err(`Wrong Password! Skipping - ${bot.email}`)
							writeLog(`Wrong Password! Skipping - ${bot.email}`,'Error:')
							if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
								fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
							}
							skippedBots(botdb.indexOf(bot))
							callback()
							return
						} else if($(`form[name="ATOPinChallengeForm"]`).length !== 0){
							log_err(`Pin requested for Bot #${botdb.indexOf(bot) + 1}!`)
							writeLog(`Pin requested for Bot #${botdb.indexOf(bot) + 1}!`,'Error:')
							var dts = $('input[name="dts"]').attr('value')
							var treeId = $('meta[name="treeID"]').attr('content')
							var chal_id = $('input[name="security-challenge-id"]').attr('value')
							var alias = $('input[name="sourceAlias"]').attr('value')
							var pins = await mailconfirm()

							options['headers'] = {
								'authority': 'www.linkedin.com',
								'method': 'POST',
								'path': '/uas/ato-pin-challenge-submit',
								'scheme': 'https',
								'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
								'accept-encoding': 'gzip, deflate, br',
								'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6',
								'cache-control': 'max-age=0',
								'content-type': 'application/x-www-form-urlencoded',
								'origin': 'https://www.linkedin.com',
								'referer': 'https://www.linkedin.com/',
								'upgrade-insecure-requests': 1,
								'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.67 Safari/537.36'
							}

							var new_cookies = resp.headers['set-cookie']

							if(!new_cookies){
								log_err(`3Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${bot.email}`)
								writeLog(`3Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${bot.email}`)
								console.log(`CSRF: ${bot.csrf}`)
								console.log(`Cookies: ${bot.cookies}`)
								console.log(`Headers: ${resp.headers}`)
								log_err('')
								setTimeout(login,4000)
								return
							}

							for(cookie of new_cookies){
								var name = cookie.match(/([^.]*?)=([^.]*?);/)[1]
								var val = cookie.match(/([^.]*?)=([^.]*?);/)[2]

								if(val.indexOf('delete') == -1){
									val = val.replace(/"/g,'')
									options.cookies[`${name}`] = val
								}
							}

							var cnt = 0
							pin_submit_2()

							function pin_submit_2(){

								var obj = {
									PinVerificationForm_pinParam: pins[cnt],
									signin: 'Submit',
									'security-challenge-id': chal_id,
									dts: dts,
									origSourceAlias: '',
									csrfToken: resp.cookies['JSESSIONID'],
									sourceAlias: alias
								}

									needle.post(`https://www.linkedin.com/uas/ato-pin-challenge-submit`, obj, options, async function(err, resp){

									if ((err == null) && (resp.statusCode === 200)) {
										var $ = cheerio.load(resp.body)

										if($(`form[name="ATOPinChallengeForm"]`).length !== 0){
											console.log('Trying next pin')
											writeLog(`Trying next pin`,'Note:')
											cnt++
											if(cnt < pins.length){
												pin_submit_2()
											} else {
												console.log(`No more pins! Skipping - ${bot.email}`)
												writeLog(`No more pins! Skipping - ${bot.email}`,'Note:')
												if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
													fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
												}
												skippedBots(botdb.indexOf(bot))
												callback()
											}				
										} else {
											record_cookie(resp.headers)
										}

										fs.writeFileSync('t.html',resp.body,function(){})
									} else {
										console.log(err)
										writeLog(err,'Error:')
									}
								})
							}

						} else {
							fs.writeFileSync('ttest.html',resp.body,function(){})
						//	await solveCaptcha()
							record_cookie(resp.headers)
						}

						function record_cookie(headers,cap,body){
							function proceed(newOptionsCookies = true){
								log(`Login for Bot #${botdb.indexOf(bot) + 1} complete! (${bot.email})`)
								writeLog(`Login for Bot #${botdb.indexOf(bot) + 1} complete! (${bot.email})`,'Info:')
								login_done = true
								if(newOptionsCookies){
									options.cookies = bot.cookies
								}
								options.follow_max = 5
								options.follow_set_cookies = true
								streamline()
							}
							if(!cap){
								if('location' in headers && isRedirectUrl(headers['location']))
								{
									bot.csrf = options.cookies.JSESSIONID;
									proceed(false);
									return;
								}

								var new_cookies = headers['set-cookie']
								bot.cookies = options['cookies']

								if(!new_cookies){
									log_err(`1Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${bot.email}`)
									writeLog(`1Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${bot.email}`)
									console.log(`CSRF: ${util.inspect(bot.csrf)}`)
									console.log(`Cookies: ${util.inspect(bot.cookies)}`)
									console.log(`Headers: ${util.inspect(headers)}`)
									console.log(`Body: ${body}`)
									setTimeout(login,4000)
									return
								}

								for(cookie of new_cookies){
									var name = cookie.match(/([^.]*?)=([^.]*?);/)[1]
									var val = cookie.match(/([^.]*?)=([^.]*?);/)[2]

									if(val.indexOf('delete') == -1){
										val = val.replace(/"/g,'')
										bot.cookies[`${name}`] = val
									}
								}

								if((bot.csrf == '' || bot.csrf === undefined) && (bot.cookies !== '' || bot.cookies !== undefined)){
									var new_cookies = resp.headers['set-cookie']
									bot.cookies = options['cookies']
		
									for(cookie of new_cookies){
										var name = cookie.match(/([^.]*?)=([^.]*?);/)[1]
										var val = cookie.match(/([^.]*?)=([^.]*?);/)[2]
		
										if(val.indexOf('delete') == -1){
											val = val.replace(/"/g,'')
											bot.cookies[`${name}`] = val
										}
									}
		
									bot.csrf = resp.cookies.JSESSIONID
		
									if(bot.csrf && !login_done){
										log(`Login for Bot #${botdb.indexOf(bot) + 1} complete! (${bot.email})`)
										writeLog(`Login for Bot #${botdb.indexOf(bot) + 1} complete! (${bot.email})`,'Info:')
										login_done = true
										options.cookies = bot.cookies
				
										streamline()
									} else {
										login()
									}
								} else {
									log_err(`2Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${bot.email}`)
									writeLog(`2Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${bot.email}`)
									console.log(`CSRF: ${bot.csrf}`)
									console.log(`Cookies: ${bot.cookies}`)
									console.log(`Headers: ${resp.headers}`)
									log_err('')
									setTimeout(login,4000)
									return
								}
							} else {
								for(cookie of headers){
									var name = cookie.name
									var val = cookie.value
									if(val.indexOf('delete') == -1){
										val = val.replace(/"/g,'')
										bot.cookies[`${name}`] = val
									}
								}

								bot.csrf = bot.cookies['JSESSIONID']

								if(bot.csrf && !login_done){
									proceed();
								} else {
									callback(true)
								}
							}
						}
									
					} else {
						console.log('login Error')
						log_err(err)
						writeLog(err,'Error:')
						login()
					}
				})
			} else {
				console.log('login Error1')
				log_err(err)
				writeLog(err,'Error:')
				login()
			}

		})

	}

	function mailconfirm(repeated){
		return new Promise(function(resolve,reject){

			function getMails(){

				var options = {
					compressed         : true,
					rejectUnauthorized : false,
					open_timeout: 10000,
					response_timeout: 10000,
					read_timeout: 10000,
					proxy: bot.proxy + ':' + bot.port
				}
			
				options['headers'] = {
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
					'Accept-Encoding': 'gzip, deflate, br',
					'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6',
					'Connection': 'keep-alive',
					'Host': 'mail.ru',
					'Upgrade-Insecure-Requests': 1,
					'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'
				}

				needle.get(`https://mail.ru/`, options, function(err, resp){

					if ((err == null) && resp.statusCode === 200) {
						options['cookies'] = resp.cookies
						options['headers'] = {
							'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
							'Accept-Encoding': 'gzip, deflate, br',
							'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6',
							'Cache-Control': 'max-age=0',
							'Connection': 'keep-alive',
							'Content-Type': 'application/x-www-form-urlencoded',
							'Host': 'auth.mail.ru',
							'Origin': 'https://mail.ru',
							'Referer': 'https://mail.ru/',
							'Upgrade-Insecure-Requests': 1,
							'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'
						}
						options.follow_max = 15
						options.follow_set_cookies = true

						var bot_auth = {
							Login: bot.email,
							Domain: 'mail.ru',
							Password: bot.passMail,
							saveauth: 0,
							FromAccount: 0,
							token: resp.cookies['act']
						}

						needle.post(`https://auth.mail.ru/cgi-bin/auth?from=splash`,bot_auth, options, function(err, resp){
							if ((err == null) && resp.statusCode === 200) {
								options['cookies'] = Object.assign(options['cookies'],resp.cookies)

								var token = resp.body.match(/patron.updateToken\("([a-zA-Z0-9:]+)/)
								if(token !== null){
									token = token[1]
								} else {
									console.log(`Token Error for Bot #${botdb.indexOf(bot) + 1}(mailru), repeating`)
									writeLog(`Token Error for Bot #${botdb.indexOf(bot) + 1}(mailru), repeating`,'Error:')
									if(repeated){
										console.log(`2nd Token Error for Bot #${botdb.indexOf(bot) + 1}(mailru), skipping`)
										writeLog(`2nd Token Error for Bot #${botdb.indexOf(bot) + 1}(mailru), skipping`)
										if(fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
											fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
										}
										skippedBots(botdb.indexOf(bot))
										callback()
										return
									} else {
										mailconfirm(true)
										return
									}
								}

								var date = new Date()
								date = date.getTime()
								
								var rnd = Math.random()

								var obj = {'__urlp':`/threads/status/smart?ajax_call=1&x-email=${bot.email.replace('@','%40')}&tarball=e.mail.ru-f-delta-mail-66782-shkinev-1539848907.tgz&tab-time=${date}&email=${bot.email.replace('@','%40')}&sort=%7B%22type%22%3A%22date%22%2C%22order%22%3A%22desc%22%7D&offset=0&limit=26&folder=0&htmlencoded=false&last_modified=-1&filters=%7B%7D&letters=true&nolog=1&sortby=D&rnd=${rnd}&api=1&token=${token.replace(':','%3A')}`}

								options['headers'] = {
									'Accept': 'text/plain, */*; q=0.01',
									'Accept-Encoding': 'gzip, deflate, br',
									'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6',
									'Connection': 'keep-alive',
									'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
									'Host': 'e.mail.ru',
									'Origin': 'https://e.mail.ru',
									'Referer': 'https://e.mail.ru/',
									'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
									'X-Requested-With': 'XMLHttpRequest'
								}

								needle.post(`https://e.mail.ru/api/v1`,obj, options, function(err, resp){
									if ((err == null) && resp.statusCode === 200) {

										var threads = resp.body.body.threads

										var ln_threads = threads.filter(function(cur){return cur.correspondents.from[0].email == 'security-noreply@linkedin.com'})

										if(ln_threads.length !== 0){

											var pin = []

											var getM = tress(function(query,callback){
												
												needle.post(`https://e.mail.ru/api/v1`,query, options, function(err, resp){
													if ((err == null) && resp.statusCode === 200) {

														if(query['__urlp'].indexOf('threads') !== -1){
															var message = resp.body.body.messages[0].body.text.match(/Please use this verification code to complete your sign in: ([0-9]+)/)
														
															if(message !== null){
																pin.push(message[1])
	
																if(resp.body.body.messages.length > 1){
																	for(var i=1;i<resp.body.body.messages.length;i++){
																		var obj = {'__urlp':`/messages/message?ajax_call=1&x-email=${bot.email.replace('@','%40')}&tarball=e.mail.ru-f-delta-mail-66782-shkinev-1539848907.tgz&tab-time=${date + 20}&email=${bot.email.replace('@','%40')}&htmlencoded=false&multi_msg_prev=0&multi_msg_past=0&sortby=D&NewAttachViewer=1&AvStatusBar=1&let_body_type=let_body_plain&log=0&bulk_show_images=0&folder=0&wrap_body=0&id=${resp.body.body.messages[i].id}&read=${resp.body.body.messages[i].id}&NoMSG=true&mark_read=true&api=1&token=${token.replace(':','%3A')}`}
																		getM.push(obj)
																	}
																}
	
																callback()
															} else {
																callback()
																return
															}

														} else {
															var message = resp.body.body.body.text.match(/Please use this verification code to complete your sign in: ([0-9]+)/) 
														
															if(message !== null){
																pin.push(message[1])
	
																callback()
															} else {
																callback()
																return
															}
														}


													} else {
														console.log(`Error: couldn't open message`)
														writeLog(`Error: couldn't open message`,'Error:')
														callback(true)
													}
												})

											},5)

											getM.drain = function(){
												if(pin.length !== 0){
													resolve(pin)
												} else {
													log_err(`Wrong Message(no pins messages) on Bot #${botdb.indexOf(bot) + 1}!`)
													writeLog(`Wrong Message(no pins messages) on Bot #${botdb.indexOf(bot) + 1}!`,'Error:')
													callback()
													return
												}
											}
											
											getM.retry = function(){
												getM.pause()
													
												setTimeout(function(){
													getM.resume()
												}, 1000)
											}
												
											for(thread of ln_threads){
												var obj = {'__urlp':`/threads/thread?ajax_call=1&x-email=${bot.email.replace('@','%40')}&tarball=e.mail.ru-f-delta-mail-66782-shkinev-1539848907.tgz&tab-time=${date + 20}&email=${bot.email.replace('@','%40')}&offset=0&limit=50&htmlencoded=false&id=${thread.id.replace(/:/g,'%3A')}&api=1&token=${token.replace(':','%3A')}`}
												getM.push(obj)
											}

										} else {
											console.log('No messages yet')
											writeLog('No messages yet','Note:')
											setTimeout(getMails,10000)
										}

									} else {
										console.log(err)
										writeLog(err,'Error:')
										setTimeout(getMails,10000)
									}
								})

							} else {
								console.log(err)
								writeLog(err,'Error:')
								setTimeout(getMails,10000)
							}
						})

					} else {
						console.log(err)
						writeLog(err,'Error:')
						setTimeout(getMails,10000)
					}
				})

			}

			setTimeout(getMails,5000)

		})
	}

	async function solveCaptcha(){
		return new Promise(async function(resolve,reject){

		var options   = new chrome.Options();
		options.addArguments("window-size=1680,1050");
		options.addArguments("disable-web-security");
		options.addArguments("allow-running-insecure-content");
		options.addArguments("headless");
		options.addArguments("--disable-gpu");
		options.addArguments("--log-level=3");
		options.addArguments("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36");
		
		var capabilities = webdriver.Capabilities.chrome()
		capabilities.setPageLoadStrategy('none')

		var driver = new webdriver.Builder()
		.forBrowser('chrome')
		.withCapabilities(capabilities)
		.setProxy(proxy.manual({http:`${bot.proxy}:${bot.port}`,https:`${bot.proxy}:${bot.port}`}))
		.setChromeOptions(options)
		.build();

		await driver.get('https://www.linkedin.com')
		await domCheck('complete')
		await driver.wait(until.elementLocated(By.id('login-email')),25000)
		await driver.findElement({id:'login-email'}).clear()
		await driver.sleep(2000)
		await driver.findElement({id:'login-email'}).sendKeys(bot.email)
		await driver.findElement({id:'login-password'}).sendKeys(bot.pass)
		await driver.sleep(1500)
		await driver.findElement({id:'login-submit'}).click()
		await domCheck('complete')

		var type_1 = await driver.findElements({id:'challengeContent'})
		var type_2 = await driver.findElements({id:'captcha-challenge'})
		var attempts = 0

		if(type_1.length == 0 && type_2.length == 0){
			var ckies = await driver.manage().getCookies()
			await driver.quit()
			resolve(ckies)
			return
		} else {
		//	await driver.sleep(100000000)
			var gkey = ''
			var url = ''
	
			await driver.getCurrentUrl().then(function(lnk){
		
				url = lnk;
				
				getGkey()
				
			})
			
			function getGkey(){
				
				driver.sleep(3000).then(function(){
					driver.findElements({css:'input[type="hidden"]'}).then(function(els){
						els.forEach(function(el){
							el.getAttribute('value').then(function(val){		
								if(val.length == 40){
									gkey = val
								}
							}).catch(function(){
								//
							})
						})
					}).then(function(){
						if(gkey == ''){
							getGkey()
						} else {
							main()
						}
					})
				})
				
			}
	
			function main(){
				var key = '1a21be9ca8506169bd5b2a310457a8d0'
				var code = ''
				var tries = 0;
			
				var requestOptions = {
					url: `http://2captcha.com/in.php?key=${key}&method=userrecaptcha&googlekey=${gkey}&pageurl=${url}`,
					method: 'GET'
				}
					
				request(requestOptions, function (err, resp, body) {
					if ((err == null) && resp.statusCode === 200) {	
						code = body.substring(3,body.length);
						console.log(`Got response from 2captcha - ${body}`)
						writeLog(`Got response from 2captcha - ${body}`,'Info:')
					}
				})
				
				var ans = '';
				
				var chk = setInterval(function(){
						
					var requestOptions = {
					url: `http://2captcha.com/res.php?key=${key}&action=get&id=${code}`,
						method: 'GET'
					}
						
					request(requestOptions, function (err, resp, body) {
						if ((err == null) && resp.statusCode === 200) {			
							tries++;				
							if(body.length > 40){
								console.log('Got captcha answer from 2captcha')
								writeLog('Got captcha answer from 2captcha','Info:')
								ans = body.substring(3,body.length)
								clearInterval(chk)
								goNext(ans).then(function(){},function(){resolve(false)})
							} else {
								console.log(body)
								if(tries == 10){
									console.log('Captcha solving timed out. Sending another request...')
									writeLog('Captcha solving timed out. Sending another request...','Info:')
									clearInterval(chk)
									main();
								}
							}
							
						}
					})
					
				},10000)
			}
	
			async function goNext(ans){
				
				var type_3 = await driver.findElements({id:'challengeContent'})
				var type_4 = await driver.findElements({id:'captcha-challenge'})
				await driver.switchTo().frame(0)
				await driver.wait(until.elementLocated(By.name('g-recaptcha-response')),30000)
				var el = await driver.findElement({name:'g-recaptcha-response'})
				await driver.executeScript("arguments[0].setAttribute('style', 'display:block')",el)
				await el.sendKeys(ans)
				var handles = await driver.getAllWindowHandles()
				await driver.switchTo().window(handles[handles.length - 1])
				await driver.sleep(3000)
				if(type_1.length > 0){
					await driver.executeScript(`window.espanyContainer.contentWindow.grecaptchaData.callback()`)
				} else if(type_2.length > 0){
					var el = await driver.findElement({css:'input[name="captchaUserResponseToken"]'})
					await driver.executeScript(`arguments[0].setAttribute('value','${ans}')`,el)
					await driver.findElement({id:'captcha-challenge'}).submit()
				}
				await driver.sleep(15000)
				type_3 = await driver.findElements({id:'challengeContent'})
				type_4 = await driver.findElements({id:'captcha-challenge'})
		
				if(type_3.length !== 0 || type_4.length !== 0){
					log('Failed captcha, retrying')
					writeLog('Failed captcha, retrying','Error:')
					if(attempts < 5){
						attempts++
						main()
					} else {
						log_err(`Too many attempts to solve captcha for ${bot.email}, skipping`)
						writeLog(`Too many attempts to solve captcha for ${bot.email}, skipping`,'Error:')
						if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
							fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
						}
						skippedBots(botdb.indexOf(bot))
						await driver.quit()
						callback()
					}
				} else {
					log('Passed captcha!')
					writeLog('Passed captcha!','Info:')
					var els = await driver.findElements({id:'error-for-password'})
					var els2 = await driver.findElements({id:'session_password-login-error'})
					var els3 = await driver.findElements({id:'idverifyUrl'})
					var els4 = await driver.findElements({css:'form[name="ATOPinChallengeForm"]'})
					var els5 = await driver.findElements({id:'pagekey-uas-account-restricted'})
					var els6 = await driver.findElements({id:'email-pin-error'})
					if(els.length > 0 || els2.length > 0){
						log_err(`Wrong Password! Skipping - ${bot.email}`)
						writeLog(`Wrong Password! Skipping - ${bot.email}`,'Error:')
						if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
							fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
						}
						skippedBots(botdb.indexOf(bot))
						await driver.quit()
						resolve(false)
					} else {
						if(els3.length > 0 || els5.length > 0){
							log_err(`Account is banned! Skipping - ${bot.email} Bot #${botdb.indexOf(bot) + 1}`)
							writeLog(`Account is banned! Skipping - ${bot.email} Bot #${botdb.indexOf(bot) + 1}`,'Error:')
							if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
								fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
							}
							skippedBots(botdb.indexOf(bot))
							await driver.quit()
							resolve(false)
						} else {
							if(els4.length > 0 || els6.length > 0){
								log_err(`Pin required for account - ${bot.email} - will try to log normally`)
								writeLog(`Pin required for account - ${bot.email} - will try to log normally`,'Error:')
								await driver.quit()
								callback()
								return
							} else {
								var ckies = await driver.manage().getCookies()
								await driver.quit()
								resolve(ckies)
							}
						}	
					}
				}
						
			}
		}

		function domCheck(type){
			return new Promise(function(resolve,reject){
				var rscheck = setInterval(function(){
				driver.executeScript("return document.readyState").then(function(rs){
				//	console.log(rs)
					if(type == undefined){
						if(rs == 'interactive' || rs == 'complete'){
							clearInterval(rscheck)
							resolve(rs)
						}
					} else {
						if(type == 'complete'){
							if(rs == 'complete'){
								clearInterval(rscheck)
								resolve(rs)
							}
						}
					}
				})
				},1000)
			})
		}
	})
}

	function streamline(){
	
		if(functions.length >= fstart + 1){
	
				switch (functions[fstart]){
					case 'geturl':
						fstart++
						setTimeout(function(){geturl(true,null)},between_functions)
						break
					case 'privacy':
						fstart++
						setTimeout(function(){privacy()},between_functions)
						break
					case 'details':
						fstart++
						setTimeout(function(){details()},between_functions)
						break
					case 'avatar':
						fstart++
						setTimeout(function(){avatar()},between_functions)
						break
					case 'experience':
						fstart++
						setTimeout(function(){experience()},between_functions)
						break
					case 'education':
						fstart++
						setTimeout(function(){education()},between_functions)
						break
					case 'skillset':
						fstart++
						setTimeout(function(){skillset()},between_functions)
						break
					case 'changepw':
						fstart++
						setTimeout(function(){changepw()},between_functions)
						break
					case 'invitesettings':
						fstart++
						setTimeout(function(){invitesettings()},between_functions)
						break
					case 'acceptinvites':
						fstart++
						setTimeout(function(){acceptinvites()},between_functions)
						break
					/* case 'headline':
						fstart++
						setTimeout(function(){headline()},between_functions)
						break */
				}
				
		} else {
			log(`All functions are done for ${bot.email}!`)
			writeLog(`All functions are done for ${bot.email}!`,'Info:')
			if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
				fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`, function(err, res) {
					console.log('error', err);
				})
			}
			callback()
			return
		}
		
	}

	function geturl(sl,func){

		options['headers'] = {
			'authority': 'www.linkedin.com',
			'method': 'GET',
			'path': '/feed/?trk=',
			'scheme': 'https',
			'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
			'accept-encoding': 'gzip, deflate, br',
			'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6',
			'cache-control': 'max-age=0',
			'referer': 'https://www.linkedin.com/',
			'upgrade-insecure-requests': 1,
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36'
		}

		needle.get('https://www.linkedin.com/feed/?trk=', options, function(err, resp){
            if ((err == null) && resp.statusCode === 200) {
				
				resp.body = resp.body.replace(/&quot;/g,'')
				var lnk = resp.body.match(/publicIdentifier:([a-zA-Z0-9-_]*)/)

				if(lnk !== null){
					lnk = `https://www.linkedin.com/in/${lnk[1]}`
				} else {
					log_err(`Probably wrong page, error getting url address for ${bot.email}, repeating`)
					geturl()
					return
				}

				if(sl){
					log(`Now the profile link for Bot #${botdb.indexOf(bot) + 1} is - ${lnk}`)
					writeLog(`Now the profile link for Bot #${botdb.indexOf(bot) + 1} is - ${lnk}`,'Info:')
					streamline()
				} else {
					tag = lnk
					switch (func) {
						case 'details':
							details()
							break
						case 'avatar':
							avatar()
							break
						case 'experience':
							experience()
							break
						case 'education':
							education()
							break
						case 'skillset':
							skillset()
							break
						case 'headline':
							headline()
							break
					}
				}

			} else {
				log_err(err)
				geturl(sl,func)
				return
			}
		})
		
	}

	function isRedirectUrl(location){
		return location.includes('redir');
	}

},number_of_instances)

bots.drain = function(){

	console.log('All Done')
	writeLog('All Done!','Info:')
	
}

var botsActive = [];
var oldBots = [];
var botStart = 0;

fs.readdirSync(__dirname).forEach(file => {
	if(file.indexOf(".lock") !== -1){
		oldBots.push(parseInt(file.replace('bot','').replace('.lock','')));
	}
})

oldBots.sort(function(a,b){return a-b})

if(oldBots.length > 0){
	botStart = oldBots[oldBots.length - 1]
}

fs.readdirSync(__dirname).forEach(file => {
	if(file.indexOf(".lock") !== -1){
		if (fs.existsSync(`log.txt`)) {
			fs.unlink(file, function(err, res) {
				if (err) {
					console.log('error', err)
				}
			})
		}
	}
	if(file == 'log.txt'){
		if (fs.existsSync(`log.txt`)) {
			fs.unlink('log.txt', function(err, res) {
				if (err) console.log('error', err)
			})
		} else {
			//console.log('no')
		}
	}
})

for(i=0;i<oldBots.length;i++){
	botsActive.push(botdb[oldBots[i] - 1])
}

for(i=botStart;i<botdb.length;i++){
	botsActive.push(botdb[i])
}

bots.push(botsActive);

function skippedBots(botNum){
	
	var data = `${botNum + 1}\n`
	
	fs.appendFile('skipped.txt','\ufeff' + data, {encoding: 'utf-8'} , function (err) {
		if (err) {
			//console.log(err);
		// append failed
		}
	})
	
}

function writeLog(message,type){
	var data = `${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')} [${type}] ${message}\n`
	
	fs.appendFile('log.txt','\ufeff' + data, {encoding: 'utf-8'} , function (err) {
		if (err) {
			console.log(err);
		// append failed
		}
	})
}