var request = require('request');
var tress = require('tress');
var cheerio = require('cheerio');
var moment = require('moment');
var fs = require('fs');

/* Waiting timers */

var between_functions = 100;
var between_actions = 100;
var number_of_instances = 2;
var accept_invites_rounds = 10;

var functions = ['geturl']

/* LIST OF POSSIBLE FUNCTIONS */
/* 'mailconfirm'

mailconfirm
privacy
details
avatar
experience
education
skillset
changepw
invitesettings
acceptinvites

geturl

^ this one is what you requested. It goes to the feedpage and gets the url that leading to the profile
and saves it

*/

    webdriver = require('selenium-webdriver')
	proxy = require('selenium-webdriver/proxy')
    chrome    = require('selenium-webdriver/chrome')
    By        = webdriver.By,
    until     = webdriver.until,
    options   = new chrome.Options();
    options.addArguments("window-size=1680,1050");
	options.addArguments("disable-web-security");
    options.addArguments("allow-running-insecure-content");
	if(process.argv[2] == 'headless'){
	options.addArguments("headless");
	options.addArguments("--disable-gpu");
	}
	options.addArguments("--log-level=3");
	options.addArguments("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36");
	path = require('chromedriver').path;
    service = new chrome.ServiceBuilder(path).build();
    chrome.setDefaultService(service);
		
	botdb = fs.readFileSync('linkedin-setup-input.csv', 'utf-8')
		.split('\r\n')
		.filter(Boolean);
		
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
			console.log(err);
		// append failed
		}
	})
	
	var login_tries = 0
	var mail_max = 0
	var profileLink = ''
	var errors = 0
	var called = false
	var fstart = 0
	var invites_accepted = 0
	
	capabilities = webdriver.Capabilities.chrome()
	capabilities.setPageLoadStrategy('none')
	
	var driver = new webdriver.Builder()
    .forBrowser('chrome')
    .withCapabilities(capabilities)
	.setProxy(proxy.manual({bypass:['*mail.ru'],http:`${bot.proxy}:${bot.port}`,https:`${bot.proxy}:${bot.port}`}))
    .setChromeOptions(options)
    .build();
	
	login().then(function(){},function(){loginErr()});
	
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

async function login(){
	
login_tries++;
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
//await driver.sleep(100000000)
login_check()
//useMail('pin')

}

async function loginErr(){

	if(login_tries < 4){
		login().then(function(){},function(){loginErr()})
	} else {
		record(`Login failed on Bot #${botdb.indexOf(bot) + 1} (${bot.name} <-> Proxy error)`,'Error')
		fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
		botsActive.splice(botsActive.indexOf(bot),1)
		skippedBots(botdb.indexOf(bot))
		driver.quit()
		callback()
	}
	
}

function login_check(){
	
	driver.getCurrentUrl().then(function(url){
	if(url.indexOf('add-phone') !== -1){
		record(`--> Logged in: Bot #${botdb.indexOf(bot) + 1} - ${bot.name}`,'Info')
		streamline()
	} else {
		driver.wait(until.elementLocated(By.id('a11y-menu')),15000).then(function(){
			record(`--> Logged in: Bot #${botdb.indexOf(bot) + 1} - ${bot.name}`,'Info')
			streamline()
		}).catch(function(){
				driver.findElements({id:'challengeContent'}).then(function(els){
					if(els.length > 0){
						record(`Login failed on Bot #${botdb.indexOf(bot) + 1} (${bot.name} <-> Captcha)`,'Error')
						solveCaptcha()
					} else {
						driver.findElements({id:'idverifyUrl'}).then(function(els){
							if(els.length > 0){
								record(`Login failed on Bot #${botdb.indexOf(bot) + 1} (${bot.name} <-> Banned)`,'Error')
								fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
								botsActive.splice(botsActive.indexOf(bot),1)
								skippedBots(botdb.indexOf(bot))
								driver.quit()
								callback()
							} else {
								driver.findElements({id:'session_password-login-error'}).then(function(els){
									if(els.length > 0){
										record(`Login failed on Bot #${botdb.indexOf(bot) + 1} (${bot.name} <-> Wrong Password)`,'Error')
										fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
										botsActive.splice(botsActive.indexOf(bot),1)
										skippedBots(botdb.indexOf(bot))
										driver.quit()
										callback()
									} else {
										driver.findElements({name:'ATOPinChallengeForm'}).then(function(els){
											if(els.length > 0){
												record(`Login failed on Bot #${botdb.indexOf(bot) + 1} (${bot.name} <-> Need Pin! Obtaining..)`,'Warning')
												useMail('pin').then(function(){},function(){mailError('pin')})
											} else {
												record(`Login failed on Bot #${botdb.indexOf(bot) + 1} (${bot.name} <-> null)`,'Error')
												if(login_tries < 4){
													login()
												} else {
													record(`Maximum login tries reached. Skipping Bot #${botdb.indexOf(bot) + 1}`,'Info')
													fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
													botsActive.splice(botsActive.indexOf(bot),1)
													skippedBots(botdb.indexOf(bot))
													driver.quit()
													callback()
												}
											}
										})
									}
								})
							}
						})
					}
				})
		})
	}
	})
}

function solveCaptcha(){
	
var url = '';
var gkey = '';

driver.getCurrentUrl().then(function(lnk){
	
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
					ans = body.substring(3,body.length)
					clearInterval(chk)
					goNext(ans).then(function(){},function(){login()});
				} else {
					console.log(body)
					if(tries == 10){
						console.log('Captcha solving timed out. Sending another request...')
						clearInterval(chk)
						main();
					}
				}
				
			}
		})
		
	},10000)
}

async function goNext(ans){
	
await driver.switchTo().frame(0)
await driver.wait(until.elementLocated(By.name('g-recaptcha-response')),30000)
var el = await driver.findElement({name:'g-recaptcha-response'})
await driver.executeScript("arguments[0].setAttribute('style', 'display:block')",el)
await el.sendKeys(ans)
var handles = await driver.getAllWindowHandles()
await driver.switchTo().window(handles[handles.length - 1])
await driver.sleep(3000)
await driver.executeScript(`window.espanyContainer.contentWindow.grecaptchaData.callback()`)
await driver.sleep(15000)
login_check()
	
}

}


async function useMail(type){
	
mail_max++;
	
await driver.sleep(5000) //Timeout before we go check email
await driver.executeScript('window.open("about:blank","_blank");')
var handles = await driver.getAllWindowHandles()
await driver.switchTo().window(handles[handles.length - 1])
await driver.get('https://www.mail.ru')
await domCheck()
await driver.findElement({id:'mailbox:login'}).clear()
await driver.sleep(2000)
await driver.findElement({id:'mailbox:login'}).sendKeys(bot.email)
await driver.findElement({id:'mailbox:password'}).sendKeys(bot.passMail)
await driver.sleep(1500)
await driver.findElement({css:'input[value="Войти"]'}).click()
await domCheck()
await driver.wait(until.elementLocated(By.xpath('//span[text()[contains(.,"Входящие")]]')),30000)
await driver.findElement({xpath:'//span[text()[contains(.,"Входящие")]]'}).click()
await domCheck()
await driver.wait(until.elementsLocated(By.css('div[data-bem="b-datalist__item"]')),60000)
var els = await driver.findElements({css:'div[data-bem="b-datalist__item"]'})
await els[0].click()
await domCheck()
	switch (type){
		case 'pin':
			await driver.wait(until.elementLocated(By.xpath('//td[text()[contains(.,"Please use this verification code")]]')),30000)
			var txt = await driver.findElement({xpath:'//td[text()[contains(.,"Please use this verification code")]]'}).getAttribute("innerText")
			var code = txt.replace(/[^0-9]/g, '');
			await driver.findElement({id:'PH_logoutLink'}).click()
			await driver.sleep(2000)
			await driver.close()
			await driver.switchTo().window(handles[0])
			await driver.findElement({name:'PinVerificationForm_pinParam'}).sendKeys(code)
			await driver.findElement({id:'btn-primary'}).click()
			await domCheck()
			mail_max = 0
			record(`--> Logged in: Bot #${botdb.indexOf(bot) + 1} - ${bot.name}`,'Info')
			streamline()											
			break;
		case 'confirm':
			await driver.wait(until.elementLocated(By.linkText('this')),30000)
			await driver.findElement({linkText:'this'}).click()
			await domCheck()
			await driver.sleep(5000)
			record(`Email confirmed for Bot #${botdb.indexOf(bot) + 1} - ${bot.name}`,'Info')
			handles = await driver.getAllWindowHandles()
			await driver.switchTo().window(handles[handles.length - 1])
			await driver.close()
			await driver.switchTo().window(handles[handles.length - 2])
			await driver.close()
			await driver.switchTo().window(handles[handles.length - 3])
			streamline()
			break;
		}
		
}

function mailError(type){
	
	var terminate = false;
	
	tryWrongPass().then(function(){main()},function(){main()})
	
	
	function main(){
		
		if(terminate == true){
			record(`Email password or login is incorrect for Bot #${botdb.indexOf(bot) + 1}! Skipping`,'Error')
			botsActive.splice(botsActive.indexOf(bot),1)
			skippedBots(botdb.indexOf(bot) + 1)
			driver.quit()
			callback()
		} else {
			record(`Couldn't load mail: Bot #${botdb.indexOf(bot) + 1}, repeating..`,'Error')
			if(mail_max < 4){
				tryLogout().then(function(){next()},function(){next()})
			} else {
				botsActive.splice(botsActive.indexOf(bot),1)
				record(`Max tries to open email reached for Bot #${botdb.indexOf(bot) + 1}! Skipping`,'Error')
				if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
					fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
				}
				skippedBots(botdb.indexOf(bot))
				driver.quit()
				callback()
			}
		}
	
	}
	
	async function tryWrongPass(){
		
		var els = await driver.findElements({className:'b-login__errors'})
		var els2 = await driver.findElement({id:'mailbox:error'}).isDisplayed()
		console.log(els2)
		if(els.length > 0 || els2 == true){
			if(mail_max > 3){
				terminate = true;
			}
		}
	}
	
	async function tryLogout(){
		await driver.findElement({id:'PH_logoutLink'}).click()
		await driver.sleep(2000)
	}
	
	async function next(){
		await driver.sleep(2000)
		handles = await driver.getAllWindowHandles()
		for(var i=0;i<handles.length - 1;i++){
			await driver.close()
		}
		await driver.switchTo().window(handles[0])
		useMail(type).then(function(){},function(){mailError(type)})
	}
	
}

function streamline(){
	
	if(functions.length >= fstart + 1){

			switch (functions[fstart]){
				case 'geturl':
					fstart++
					geturl().then(function(){},function(err){errorHandle('geturl',geturl)})
					break
				case 'mailconfirm':
					fstart++
					if(!lnkFound){
					mailconfirm().then(function(){},function(err){streamline()})
					} else {
					mailconfirm().then(function(){},function(err){errorHandle('mailconfirm',mailconfirm)})
					}
					break
				case 'privacy':
					fstart++
					privacy().then(function(){},function(err){errorHandle('privacy',privacy)})
					break
				case 'details':
					fstart++
					details().then(function(){},function(err){errorHandle('details',details)})
					break
				case 'avatar':
					fstart++
					avatar().then(function(){},function(err){errorHandle('avatar',avatar)})
					break
				case 'experience':
					fstart++
					experience().then(function(){},function(err){errorHandle('experience',experience)})
					break
				case 'education':
					fstart++
					education().then(function(){},function(err){errorHandle('education',education)})
					break
				case 'skillset':
					fstart++
					skillset().then(function(){},function(err){errorHandle('skillset',skillset)})
					break
				case 'changepw':
					fstart++
					changepw().then(function(){},function(err){errorHandle('changepw',changepw)})
					break
				case 'invitesettings':
					fstart++
					invitesettings().then(function(){},function(err){errorHandle('invitesettings',invitesettings)})
					break
				case 'acceptinvites':
					fstart++
					acceptinvites().then(function(){},function(err){errorHandle('acceptinvites',acceptinvites)})
					break	
			}
			
	} else {
		logout()
	}
	
}

async function geturl(){
await driver.get('https://www.linkedin.com')
await domCheck('complete')
await driver.wait(until.elementLocated(By.css('a[data-control-name="identity_welcome_message"]')),30000)
var el = await driver.findElement({css:'a[data-control-name="identity_welcome_message"]'})
var lnk = await el.getAttribute('href')
record(`Now the profile link for Bot #${botdb.indexOf(bot) + 1} is - ${lnk}`,'Info')

streamline()

}

var lnkFound = false

async function mailconfirm(){
	
	/* First, check if we need to confirm account */
	
await driver.wait(until.elementLocated(By.linkText('request a new confirmation link')),5000).then(function(el){
	if(el){
		lnkFound = true
		console.log(lnkFound)
	}
})
await driver.sleep(1000)
el = await driver.findElement({linkText:'request a new confirmation link'})
lnk = await el.getAttribute('href')
await driver.get(lnk)
await domCheck('complete')
useMail('confirm').then(function(){},function(){mailError('confirm')})

}

	/* Privacy settings */

async function privacy(){
await driver.get('https://www.linkedin.com/psettings/videos')
await domCheck('complete')
await driver.wait(until.elementLocated(By.id('option-auto-play-videos')),15000)
var el = await driver.findElement({id:'option-auto-play-videos'})
var sel = await el.isSelected()
if(sel){
	await driver.findElement({className:'checked'}).click()
}
await driver.sleep(between_actions)
await driver.get('https://www.linkedin.com/psettings/connections-visibility')
await domCheck('complete')
await driver.wait(until.elementLocated(By.id('allow-connections-browse')),15000).click()
await driver.sleep(between_actions)
await driver.findElement({css:'option[value="false"]'}).click()
await driver.sleep(between_actions)
await driver.get('https://www.linkedin.com/psettings/activity-broadcast')
await domCheck('complete')
await driver.wait(until.elementLocated(By.id('option-broadcast')),15000)
await driver.sleep(between_actions)
el = await driver.findElement({id:'option-broadcast'})
sel = await el.isSelected()
if(sel){
	await driver.findElement({className:'checked'}).click()
}
await driver.sleep(between_actions)
await driver.get('https://www.linkedin.com/psettings/browse-map')
await domCheck('complete')
await driver.wait(until.elementLocated(By.id('option-browse-map')),15000)
await driver.sleep(between_actions)
el = await driver.findElement({id:'option-browse-map'})
sel = await el.isSelected()
if(sel){
	await driver.findElement({className:'checked'}).click()
}
await driver.sleep(between_actions)
await driver.get('https://www.linkedin.com/psettings/meet-the-team')
await domCheck('complete')
await driver.wait(until.elementLocated(By.id('option-meet-the-team')),15000)
await driver.sleep(between_actions)
el = await driver.findElement({id:'option-meet-the-team'})
sel = await el.isSelected()
if(sel){
	await driver.findElement({className:'checked'}).click()
	await driver.sleep(between_actions)
	record(`Privacy settings done for Bot #${botdb.indexOf(bot) + 1}`,'Info')
	errors = 0;
	streamline()
} else {
	await driver.sleep(between_actions)
	record(`Privacy settings done for Bot #${botdb.indexOf(bot) + 1}`,'Info')
	errors = 0;
	streamline()
}
}

async function details(){
	
await driver.get('https://www.linkedin.com')
await domCheck('complete')
await driver.wait(until.elementLocated(By.css('a[data-control-name="identity_welcome_message"]')),30000)
var lnk = await driver.findElement({css:'a[data-control-name="identity_welcome_message"]'}).getAttribute('href')
await driver.get(lnk)
await domCheck('complete')
await driver.sleep(between_actions)
var url = await driver.getCurrentUrl()
await driver.get(`${url}edit/topcard`)
await domCheck('complete')
await driver.wait(until.elementLocated(By.id('topcard-firstname')),15000)
await driver.findElement({id:'topcard-firstname'}).clear()
await driver.sleep(between_actions)
await driver.findElement({id:'topcard-firstname'}).sendKeys(bot.firstname)
await driver.findElement({id:'topcard-lastname'}).clear()
await driver.sleep(between_actions)
await driver.findElement({id:'topcard-lastname'}).sendKeys(bot.lastname)
var rng = Math.floor(Math.random() * 147 + 1)
await driver.sleep(between_actions)
await driver.findElement({id:'topcard-industry'}).click()
await driver.findElement({css:`option[value="urn:li:fs_industry:${rng}"]`}).click()
await driver.sleep(between_actions)
await driver.findElement({id:'location-country'}).click()
await driver.findElement({css:`option[value="us"]`}).click()
await driver.sleep(between_actions)
await driver.findElement({id:'location-zipcode'}).clear()
await driver.findElement({id:'location-zipcode'}).sendKeys(bot.zip)
await driver.sleep(between_actions)
await driver.findElement({id:'location-country'}).submit()
await domCheck('complete')
await driver.sleep(between_actions)
await driver.get('https://www.linkedin.com')
await domCheck('complete')
var el = await driver.wait(until.elementLocated(By.css('a[data-control-name="identity_welcome_message"]')),30000)
await el.click()
await domCheck('complete')
await driver.sleep(between_actions)
var txt = await driver.findElement({className:'pv-top-card-section__name'}).getText()
record(`Now the name for Bot #${botdb.indexOf(bot) + 1} is - ${txt}`,'Info')
var profileLink = await driver.getCurrentUrl()
txt = await driver.findElement({className:'pv-top-card-section__location'}).getText()
record(`Now the location for Bot #${botdb.indexOf(bot) + 1} is - ${txt}`,'Info')
errors = 0;
await driver.sleep(between_functions)
streamline()

}

async function avatar(){

await driver.get('https://www.linkedin.com/mwlite/me/add/photo')
await domCheck('complete')
await driver.findElement({className:'select-photo-input'}).sendKeys(`C:/work/avatars/${bot.img}.jpg`)
await driver.sleep(8000)
await driver.findElement({id:'edit-profile-save'}).click()
await domCheck('complete')
await driver.wait(until.elementLocated(By.id('a11y-menu')),30000)
record(`Avatar was set for Bot #${botdb.indexOf(bot) + 1} - Profile: ${bot.firstname} ${bot.lastname}`,'Info')
errors = 0;
await driver.sleep(between_functions)
streamline()

}

async function experience(){
	
var curDate = 0;
var positions = 0;
var dates = jobdates[Math.floor(Math.random() * jobdates.length)].split(',')
	
await driver.get('https://www.linkedin.com/mwlite/me/edit')
await domCheck('complete')
deletePosition().then(function(){},function(){errorHandle('experience',experience)})
	
async function deletePosition(){
		
var els = await driver.findElements({className:'list-item-body'})

if(els.length > 0){
	await els[0].click()
	await domCheck('complete')
	await driver.findElement({id:'delete-btn'}).click()
	await driver.sleep(500)
	await driver.switchTo().alert().accept()
	await domCheck('complete')
	await driver.wait(until.elementLocated(By.className('add-link-text')),15000)
	await driver.sleep(between_actions)
	deletePosition().then(function(){},function(){errorHandle('experience',experience)})
} else {
	addPosition().then(function(){},function(){errorHandle('experience',experience)})
}

}
	
async function addPosition(){
	
positions++

var rn_c = Math.floor(Math.random() * companies.length)
var rn_t = Math.floor(Math.random() * jobtitles.length)
if(positions < 3){
	var job = jobtitles[rn_t].split(',')[1]
} else {
	var job = jobtitles[rn_t].split(',')[2]
}
		
await driver.get('https://www.linkedin.com/mwlite/me/add/position')
await domCheck('complete')
	if(positions > 1){
		await driver.wait(until.elementLocated(By.css('label[for="isCurrent"]')),10000)
		await driver.findElement({css:'label[for="isCurrent"]'}).click()
	}
await driver.sleep(between_actions)
await driver.wait(until.elementLocated(By.id('companyName')),10000)
await driver.findElement({id:'companyName'}).click()
await domCheck('complete')
await driver.wait(until.elementLocated(By.name('keyword')),10000)
await driver.findElement({name:'keyword'}).sendKeys(companies[rn_c])
await driver.wait(until.elementLocated(By.css('h3')),30000)
await driver.findElement({css:'h3'}).click()
await driver.findElement({id:'title'}).sendKeys(job)
await driver.sleep(5000)
await driver.wait(until.elementLocated(By.id('startYear')),30000)
await driver.findElement({id:'startYear'}).click()
await driver.findElement({css:`option[value="${dates[curDate]}"]`}).click()
curDate++
await driver.sleep(500)
var res = await driver.findElement({id:'endYear'}).isDisplayed()
	if(res){
		await driver.findElement({id:'endYear'}).click()
		var els = await driver.findElements({css:`option[value="${dates[curDate-2]}"]`})
			els[1].click()
			await driver.sleep(1000)
			await driver.findElement({id:'edit-profile-save'}).click()
			await domCheck('complete')
			await driver.wait(until.elementLocated(By.className('add-link-text')),15000)
			if(positions < 4){
				await driver.sleep(between_actions)
				addPosition().then(function(){},function(){errorHandle('experience',experience)})
			} else {
				await driver.sleep(between_actions)
				headline().then(function(){},function(){errorHandle('experience',experience)})
			}
	} else {
		await driver.findElement({id:'edit-profile-save'}).click()
		await domCheck('complete')
		await driver.sleep(1500)
			if(positions < 4){
				await driver.sleep(between_actions)
					addPosition().then(function(){},function(){errorHandle('experience',experience)})
			}
	}
}

async function headline(){
await driver.get('https://www.linkedin.com')
await domCheck('complete')
var el = await driver.wait(until.elementLocated(By.css('a[data-control-name="identity_welcome_message"]')),30000)
await el.click()
await domCheck('complete')
await driver.wait(until.elementLocated(By.css('a[data-control-name="edit_position"]')),30000)
await driver.sleep(between_actions)
var lnk = await driver.findElement({css:'a[data-control-name="edit_position"]'}).getAttribute('href')
await driver.get(`${lnk}`)
await domCheck('complete')
await driver.wait(until.elementLocated(By.css('label[for="position-update-headline-checkbox"]')),15000)
await driver.findElement({css:'label[for="position-update-headline-checkbox"]'}).click()
await driver.sleep(between_actions)
await driver.findElement({css:'label[for="position-update-headline-checkbox"]'}).submit()
await domCheck('complete')
await driver.wait(until.elementLocated(By.className('pv-top-card-section__headline')),15000)
record(`Working experience was filled by Bot #${botdb.indexOf(bot) + 1} - Profile: ${bot.firstname} ${bot.lastname}`,'Info')
errors = 0;
await driver.sleep(between_functions)
streamline()

}

}

async function education(){

var school = schools[Math.floor(Math.random() * schools.length)]
var fos = studies[Math.floor(Math.random() * studies.length)]
	
await driver.get('https://www.linkedin.com/mwlite/me/add/education')
await domCheck('complete')
await driver.findElement({id:'schoolName'}).click()
await domCheck('complete')
await driver.wait(until.elementLocated(By.name('keyword')),15000)
await driver.findElement({name:'keyword'}).sendKeys(school)
await driver.wait(until.elementLocated(By.css('h3')),30000)
await driver.findElement({css:'h3'}).click()
await driver.sleep(1000)
await driver.findElement({id:'fieldOfStudyName'}).sendKeys(fos)
await driver.sleep(between_actions + 8000)
await driver.findElement({id:'schoolName'}).submit()
await domCheck('complete')
await driver.wait(until.elementLocated(By.id('a11y-menu')),30000)
record(`Education was added by Bot #${botdb.indexOf(bot) + 1} - Profile: ${bot.firstname} ${bot.lastname}`,'Info')
errors = 0;
await driver.sleep(between_functions)
streamline()

}

async function skillset(){

await driver.get('https://www.linkedin.com')
await domCheck('complete')
var el = await driver.wait(until.elementLocated(By.css('a[data-control-name="identity_welcome_message"]')),30000)
await el.click()
await domCheck('complete')
await driver.wait(until.elementLocated(By.css('a[data-control-name="edit_position"]')),30000)
var url = await driver.getCurrentUrl()
await driver.get(`${url}detail/skills/add`)
await domCheck('complete')
await driver.wait(until.elementLocated(By.id('a11y-menu')),30000)
await driver.wait(until.elementLocated(By.css('input[placeholder="Skill (ex: Data Analysis)"]')),30000)
var el = await driver.findElement({css:'input[placeholder="Skill (ex: Data Analysis)"]'})
var txt = await driver.findElement({className:'pv-add-with-suggestions__skills-remaining'}).getText()
var t = parseInt(txt.replace(/[^0-9]/g,''))
	if(t > 30){
		await driver.sleep(2000)
		addSkills(el).then(function(){},function(){errorHandle('skills',skills)})
	} else {
		record(`20 skills were added by Bot #${botdb.indexOf(bot) + 1} - Profile: ${bot.firstname} ${bot.lastname}`,'Info')
		errors = 0;
		streamline()
	}
	
async function addSkills(el){

var sk = skills[Math.floor(Math.random() * skills.length)]
await el.clear()
await el.sendKeys(sk,webdriver.Key.ENTER)
var txt = await driver.findElement({className:'pv-add-with-suggestions__skills-remaining'}).getText()
var t = parseInt(txt.replace(/[^0-9]/g,''))
if(t <= 30){
	await driver.findElement({className:'button-primary-medium ml2 fr ember-view'}).click()
	await driver.sleep(2000)
	record(`20 skills were added by Bot #${botdb.indexOf(bot) + 1} - Profile: ${bot.firstname} ${bot.lastname}`,'Info')
	errors = 0;
	await driver.sleep(between_functions)
	streamline()
} else {
	await driver.sleep(2000)
	addSkills(el).then(function(){},function(){errorHandle('skills',skills)})
}
	
}

}

async function changepw(){

await driver.get('https://www.linkedin.com/psettings/change-password')
await domCheck('complete')
await driver.wait(until.elementLocated(By.css('label[for="signout-all-sessions"]')),20000)
var el = await driver.findElement({css:'label[for="signout-all-sessions"]'})
await el.click()
await domCheck('complete')
await driver.findElement({id:'cp-current-pw'}).sendKeys(bot.pass)
await driver.findElement({id:'cp-new-pw'}).sendKeys('YSOLTpass321')
await driver.findElement({id:'cp-repeat-pw'}).sendKeys('YSOLTpass321')
await driver.sleep(between_actions)
console.log('saving')
await driver.findElement({id:'save-new-password'}).click()
await driver.sleep(between_actions)
record(`Password was changed by Bot #${botdb.indexOf(bot) + 1} - Profile: ${bot.firstname} ${bot.lastname}`,'Info')
errors = 0;
await driver.sleep(between_functions)
streamline()
	
}

async function invitesettings(){
	
await driver.get('https://www.linkedin.com/psettings/invite-receive')
await domCheck('complete')
await driver.wait(until.elementLocated(By.css('label[for="all"]')),20000)
await driver.sleep(between_actions)
await driver.findElement({css:'label[for="all"]'}).click()
await driver.sleep(between_actions)
record(`Invite settings changed by Bot #${botdb.indexOf(bot) + 1} - Profile: ${bot.firstname} ${bot.lastname}`,'Info')
errors = 0;
await driver.sleep(between_functions)
streamline()
	
}

async function acceptinvites(){

await driver.get('https://www.linkedin.com/mynetwork/invitation-manager/')
await domCheck('complete')
await driver.sleep(5000)
await driver.wait(until.elementLocated(By.css('label[for="contact-select-checkbox"]')),10000)
await driver.findElement({css:'label[for="contact-select-checkbox"]'}).click()
await driver.wait(until.elementLocated(By.css('button[data-control-name="accept_all"]')),10000).then(function(){
	driver.sleep(between_actions).then(async function(){
		await driver.findElement({css:'button[data-control-name="accept_all"]'}).click()
		await driver.sleep(between_actions + 2500)
		invites_accepted++
		record(`Invites accepted by Bot #${botdb.indexOf(bot) + 1} - Profile: ${bot.firstname} ${bot.lastname} - round ${invites_accepted}`,'Info')
		if(invites_accepted < accept_invites_rounds){
			acceptinvites().then(function(){},function(err){errorHandle('acceptinvites',acceptinvites)})
		} else {
			streamline()
		}
	}).catch(function(){errorHandle('acceptinvites',acceptinvites)})
}).catch(function(){
record(`All invites accepted by Bot #${botdb.indexOf(bot) + 1} - Profile: ${bot.firstname} ${bot.lastname}`,'Info')
streamline()
})
	
}

function logout(){
	
	driver.findElement({id:'nav-settings__dropdown'}).click().then(function(){
		driver.sleep(1000).then(function(){
			driver.findElement({css:'a[href="/m/logout/"]'}).click().then(function(){
				record(`<-- Logged out Bot #${botdb.indexOf(bot) + 1}`,'Info')
				driver.sleep(2000).then(function(){
					driver.quit()
					fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
					callback()
				})
			}).catch(function(err){
				driver.quit()
				fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
				callback()
			})
		})
	}).catch(function(){
		driver.quit()
		fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
		callback()
	})
	
}

function errorHandle(name,cb){
	
	errors++;
	record(`Error with Bot #${botdb.indexOf(bot) + 1} in function ${name}`,'Error')
	
	/* Uncomment for screenshots */
	
/*	driver.takeScreenshot().then(function(image, err) {
		screen++;
        require('fs').writeFile(`error.png`, image, 'base64', function(err) {
           // console.log(err);
        });
    })
*/
	if(errors < 3){
		cb().then(function(){},function(){errorHandle(name,cb)})
	} else {
		if(called == false){
			called = true;
			driver.quit()
			if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
				fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
			}
			record(`Too many errors with Bot #${botdb.indexOf(bot) + 1}, skipping`,'Error')
			skippedBots(botdb.indexOf(bot))
			callback()
		}
	}
	
}

},number_of_instances)

bots.drain = function(){

	console.log('All Done')
	
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
			fs.unlink(file)
		}
	}
	if(file == 'log.txt'){
		if (fs.existsSync(`log.txt`)) {
			fs.unlink('log.txt')
		} else {
			console.log('no')
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

function record(message,type){
	
	var data = `${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')} [${type}] ${message}\n`
	console.log(`${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')} [${type}] ${message}`);
	
	fs.appendFile('log.txt','\ufeff' + data, {encoding: 'utf-8'} , function (err) {
		if (err) {
			console.log(err);
		// append failed
		}
	})
	
}

function skippedBots(botNum){
	
	var data = `${botNum + 1}\n`
	
	fs.appendFile('skipped.txt','\ufeff' + data, {encoding: 'utf-8'} , function (err) {
		if (err) {
			//console.log(err);
		// append failed
		}
	})
	
}