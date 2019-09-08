var request = require('request');
var tress = require('tress');
var cheerio = require('cheerio');
var moment = require('moment');
var fs = require('fs');

var number_of_instances = 1;

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

	clientdb = fs.readFileSync('clientdb.csv', 'utf-8')
		.split('\r\n')
		.filter(Boolean);
		
	clientdb.forEach(function(cur,ind,arr){
		arr[ind] = arr[ind].split(',')
	})
		
	botdb = fs.readFileSync('botdb.csv', 'utf-8')
		.split('\r\n')
		.filter(Boolean);
		
	botdb.forEach(function(cur,ind,arr){
		var tmp = arr[ind].split(',')
		arr[ind] = {
			proxy: tmp[0],
			port: tmp[1],
			email: tmp[2],
			name: tmp[3],
			pass: tmp[4]
		}
	})
	
	var opType = process.argv[3] || 'endorse'

var bots = tress(function(bot,callback){
	
	fs.writeFile(`bot${(botdb.indexOf(bot) + 1)}.lock`, phase, {encoding: 'utf-8'} , function (err) {
		if (err) {
			console.log(err);
		// append failed
		}
	})
	
	var login_tries = 0;
	var target_max = 0;
	var connect_max = 0;
	var errors = 0;
	var mail_max = 0;
	var called = false;
	
	capabilities = webdriver.Capabilities.chrome()
	capabilities.setPageLoadStrategy('none')
	
	var driver = new webdriver.Builder()
    .forBrowser('chrome')
    .withCapabilities(capabilities)
	.setProxy(proxy.manual({bypass:['*mail.ru'],http:`${bot.proxy}:${bot.port}`,https:`${bot.proxy}:${bot.port}`}))
    .setChromeOptions(options)
    .build()

	login().then(function(){},function(){loginErr()})
	
var domCount = 0;
	
function domCheck(type){
	return new Promise(function(resolve,reject){
		var rscheck = setInterval(function(){
		driver.executeScript("return document.readyState").then(function(rs){
		//	console.log(rs)
		domCount++;
		
		if(domCount > 60){
			type = undefined
		}
		
			if(type == undefined){
				if(rs == 'interactive' || rs == 'complete'){
					clearInterval(rscheck)
					domCount = 0
					resolve(rs)
				}
			} else {
				if(type == 'complete'){
					if(rs == 'complete'){
						clearInterval(rscheck)
						domCount = 0
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

var curUrl = await driver.getCurrentUrl()

if(curUrl == 'https://www.linkedin.com'){
	await driver.get('https://www.google.com')
}

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
		driver.findElement({xpath:'//button[text()[contains(.,"Skip")]]'}).click()
		.then(function(){
			driver.sleep(1500).then(function(){
				record(`--> Logged in: Bot #${botdb.indexOf(bot) + 1} - ${bot.name}`,'Info')
				processing()
			})
		})
		.catch(function(){
			driver.sleep(1500).then(function(){
				record(`--> Logged in: Bot #${botdb.indexOf(bot) + 1} - ${bot.name}`,'Info')
				processing()
			})
		})
	} else {
		driver.wait(until.elementLocated(By.id('a11y-menu')),15000).then(function(){
			record(`--> Logged in: Bot #${botdb.indexOf(bot) + 1} - ${bot.name}`,'Info')
			processing()
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
			processing()											
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
			processing()
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

/* This function is responsible for managing the actions on account after login */

var clients = -1;

function processing(){

	var botNum = botdb.indexOf(bot) + 1
	clients++
	
	if(clients >= clientdb.length){
		record(`No clients left for Bot #${botNum}, logging out`,'Info')
		logout();
	} else {
		if(botNum >= clientdb[clients][3] && botNum <= clientdb[clients][4]){
			record(`Phase ${phase}, Bot #${botNum}`,'Info')
			toTarget(clientdb[clients],opType).then(function(){},function(){errorHandle('toTarget',toTarget,clientdb[clients],opType)})
		} else {
			processing()
		}
	}

}

/* Sub functions */

async function toTarget(client,type){

if(clientStart !== null){
	if(clientdb.indexOf(client) < clientStart){
		record(`Skipping client #${(clientdb.indexOf(client) + 1)} - Done before`,'Info')
		processing()
		return
	} else {
		clientStart = null
	}
}

var wr = `${phase},${clientdb.indexOf(client)}`

fs.writeFile(`bot${(botdb.indexOf(bot) + 1)}.lock`, wr, {encoding: 'utf-8'} , function (err) {
	if (err) {
		console.log(err);
	// append failed
	}
})

target_max++;

await driver.get(client[0])
await driver.sleep(2000)
await domCheck('complete')

if(opType !== 'like' && opType !== 'follow'){
await driver.wait(until.elementLocated(By.id('a11y-menu')),30000)
var els = await driver.findElements({xpath:'//*[@id="profile-wrapper"]'})
} else {
await driver.wait(until.elementLocated(By.id('nav-typeahead-wormhole')),30000)
var els = await driver.findElements({id:'nav-typeahead-wormhole'})
}
	if(els.length > 0){
		target_max = 0;
		switch(type) {
			case 'connect':
				sub_1(client).then(function(){},function(err){console.log(err);errorHandle('Connect',sub_1,client)})
				break;
			case 'disconnect':
				sub_2(client).then(function(){},function(){errorHandle('Disconnect',sub_2,client)})
				break;
			case 'endorse':
				sub_3(client).then(function(){},function(){errorHandle('Endorse',sub_3,client)})
				break;
			case 'like':
				sub_4(client).then(function(){},function(){errorHandle('Like',sub_4,client)})
				break;
			case 'follow':
				sub_5(client).then(function(){},function(){errorHandle('Follow',sub_5,client)})
				break;
		}
	} else {
		record(`Failed to open profile ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Error')
		if(target_max < 3){
			toTarget(client,type).then(function(){},function(){errorHandle('toTarget',toTarget,client,type)})
		} else {
			record(`Max attempts to open ${client[0]} reached by Bot #${botdb.indexOf(bot) + 1}, skipping`,'Info')
			target_max = 0
			processing()
		}
	}

}

/* CONNECT SUB-FUNCTION */

async function sub_1(client){
	
//	await driver.sleep(100000000)
	
	connect_max++;
	
await driver.sleep(1000)
var els = await driver.findElements({className:'pv-s-profile-actions--connect'})
if(els == 0){
	els = await driver.findElements({className:'pv-s-profile-actions__overflow-toggle'})
	if(els == 0){
		if(connect_max < 3){
			toTarget(client,'connect').then(function(){},function(){errorHandle('toTarget',toTarget,client,'connect')})
		} else {
			record(`Couldn't Connect with ${client[0]}. Probably already connected by Bot #${botdb.indexOf(bot) + 1}, skipping`,'Info')
			errors = 0;
			connect_max = 0;
			processing()
		}
	} else {
		await els[0].click()
		await driver.sleep(1000)
		var el = await driver.findElements({className:'pv-s-profile-actions--connect'})
		if(el.length == 0){
			record(`Couldn't Connect with ${client[0]}. Probably already connected by Bot #${botdb.indexOf(bot) + 1}, skipping`,'Info')
			errors = 0;
			connect_max = 0;
			processing()
		} else {
			await el[0].click()
			await driver.wait(until.elementLocated(By.className('button-primary-large ml1')),10000)
			el = await driver.findElement({className:'button-primary-large ml1'})
			await el.click()
			await driver.wait(until.elementLocated(By.className('mn-heathrow-toast__icon--success')),10000)
			record(`Connection request sent to ${client[0]} from Bot #${botdb.indexOf(bot) + 1}`,'Info')
			record(`Processed ${clients + 1} clients with Bot #${botdb.indexOf(bot) + 1}`,'Info')
			errors = 0;
			processing();
		}
	}
} else {
	await els[0].click()
	await driver.wait(until.elementLocated(By.className('button-primary-large ml1')),30000)
	var el = await driver.findElement({className:'button-primary-large ml1'})
	await el.click()
	await driver.wait(until.elementLocated(By.className('mn-heathrow-toast__icon--success')),10000)
	record(`Connection request sent to ${client[0]} from Bot #${botdb.indexOf(bot) + 1}`,'Info')
	record(`Processed ${clients + 1} clients with Bot #${botdb.indexOf(bot) + 1}`,'Info')
	errors = 0;
	processing();
}
		
}

/* DISCONNECT SUB-FUNCTION */

async function sub_2(client){
	
	connect_max++;
	var e = false;
	
await driver.wait(until.elementLocated(By.className('pv-s-profile-actions__overflow-toggle')),30000)
var el = await driver.findElement({className:'pv-s-profile-actions__overflow-toggle'})
await el.click()
await driver.wait(until.elementLocated(By.xpath('//*[text()[contains(.,"Remove Connection")]]')),30000)
	.catch(function(){
		if(connect_max < 3){
			toTarget(client,'disconnect').then(function(){},function(){errorHandle('toTarget',toTarget,client,'disconnect')})
			e = true;
		} else {
			record(`Couldn't Disconnect with ${client[0]}. Probably already disconnected by Bot #${botdb.indexOf(bot) + 1}, skipping`,'Info')
			errors = 0;
			connect_max = 0;
			e = true;
			processing()
		}
	})
if(!e){
var el = await driver.findElement({xpath:'//*[text()[contains(.,"Remove Connection")]]'})
await el.click()
await driver.wait(until.elementLocated(By.xpath('//*[text()[contains(.,"Connection Removed")]]')),10000)
record(`Connection with ${client[0]} was removed for Bot #${botdb.indexOf(bot) + 1}`,'Info')
record(`Processed ${clients + 1} clients with Bot #${botdb.indexOf(bot) + 1}`,'Info')
errors = 0;
processing();
}

}

/* ENDORSEMENT SUB-FUNCTION */

async function sub_3(client){

for(var i=0;i<20;i++){
	await driver.executeScript("window.scrollBy(0,200)", "")
	await driver.sleep(100)
}

await driver.sleep(500)

await driver.wait(until.elementLocated(By.className('pv-skills-section__additional-skills')),10000)
var el = await driver.findElement({className:'pv-skills-section__additional-skills'})
await driver.executeScript("arguments[0].click();", el).then(function(){
	driver.executeScript("window.scrollBy(0,-1000)", "").then(function(){
		next()
	})
})
.catch(function(){
	driver.executeScript("window.scrollBy(0,-1000)", "").then(function(){
		next()
	})
})

async function next(){

var els = await driver.findElements({css:'button[data-control-name="endorse"]'})
			
			var iEndorsements = client[2] / 2
			var iPos = Math.round(Math.random())
			var randArr = []
			var rng
			
			if (phase > 1) {
				iEndorsements = Math.floor(iEndorsements);
			} else {
				iEndorsements = Math.ceil(iEndorsements);
			}
			
			if(iEndorsements > els.length){
				iEndorsements = els.length
			}
			
			if(iEndorsements + iPos > els.length){
				iPos = 0
			}
			
			console.log(iPos)
			if(phase == 2){
				client[1] = 0
			}

			record(`${client[0]} - ${iEndorsements} endorsements, ${els.length} endorsable skills, random = ${client[1] == 1 ? 'true' : 'false'}`,'Info')
					
			if(phase == 1 && client[1] == 1){
				while (randArr.length < iEndorsements) {
					rng = Math.floor(Math.random() * els.length)
					if(randArr.indexOf(rng) == -1){
						randArr.push(rng)
					}
				}
				for(var i=0;i<randArr.length;i++){
				//	driver.executeScript("window.scrollBy(0,-3000)", "")
					await driver.executeScript("arguments[0].click()", els[randArr[i]])
					await driver.sleep(300)
				}
				record(`Endorsed ${iEndorsements} skills`,'Info')
				record(`Processed ${clients + 1} clients with Bot #${botdb.indexOf(bot) + 1}`,'Info')
				driver.sleep(3000).then(function(){
					//driver.sleep(100000000)
					errors = 0;
					processing()
				})
			} else {
				for(var i=iPos;i<iEndorsements + iPos;i++){
					//driver.executeScript("window.scrollBy(0,-3000)", "")
					await driver.executeScript("arguments[0].click()", els[i]);
					await driver.sleep(300)
				}
				record(`Endorsed ${iEndorsements} skills`,'Info')
				record(`Processed ${clients + 1} clients with Bot #${botdb.indexOf(bot) + 1}`,'Info')
				driver.sleep(3000).then(function(){
					errors = 0;
					processing()
				})
			}
	}
	
}

/* LIKE SUB-FUNCTION */

async function sub_4(client){
	
//	await driver.sleep(100000000)
	
	var els = await driver.findElements({css:'li-icon[type="like-icon"]'})
	var els_2 = await driver.findElements({xpath:'//span[text()[contains(.,"Unlike")]]'})

	if(els.length > 0){
		if(els_2.length == 0){
			await driver.sleep(3000)
			await els[0].click().then(function(){
				record(`Liked ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Info')
				driver.sleep(1500).then(function(){
					errors = 0;
					processing()
				})
			}).catch(function(){
				record(`Liked ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Info')
				errors = 0;
				processing()
			})
		} else {
			record(`Already liked ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Info')
			errors = 0;
			processing()
		}
	} else {
		record(`Liked ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Info')
		errors = 0;
		processing()
	}
	
}

/* FOLLOW SUB-FUNCTION */

async function sub_5(client){

	await driver.sleep(1000)
	
	var els = await driver.findElements({className:'org-top-card-actions__follow-btn'})

	if(els.length > 0){
		await driver.wait(until.elementIsEnabled(els[0]),30000)
		await driver.executeScript("arguments[0].click();", els[0]).then(function(){
			record(`Followed ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Info')
			driver.sleep(3000).then(function(){
				errors = 0;
				processing()
			})
		}).catch(function(err){
			console.log(err)
			record(`Followed ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Info')
			errors = 0;
			processing()
		})
	} else {
		var els = await driver.findElements({css:'li-icon[type="plus-icon"]'})

		if(els.length > 0){
			await els[0].click().then(function(){
				record(`Followed ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Info')
				driver.sleep(3000).then(function(){
					errors = 0;
					processing()
				})
			}).catch(function(err){
				console.log(err)
				record(`Followed ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Info')
				errors = 0;
				processing()
			})
		} else {
			record(`Followed ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Info')
			errors = 0;
			processing()
		}
	}
	
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

function errorHandle(name,cb,p1,p2){
	
	errors++;
	record(`Error with Bot #${botdb.indexOf(bot) + 1} in function ${name}`,'Error')
	
	/* Uncomment for screenshots */
	
	driver.takeScreenshot().then(function(image, err) {
        require('fs').writeFile(`error.png`, image, 'base64', function(err) {
           // console.log(err);
        });
    })

	if(errors < 3){
		cb(p1,p2).then(function(){},function(){errorHandle(name,cb,p1,p2)})
	} else {
		if(called == false){
			called = true;
			setTimeout(function(){
				called = false
			},1000)
			record(`Too many errors on Bot #${botdb.indexOf(bot) + 1}, moving to the next target`,'Error')
			errors = 0
			processing()
		}
	}
	
}

},number_of_instances)

bots.drain = function(){

if(opType == 'endorse' && phase == 1){
	phase++
	bots.push(botsActive);
} else {
	console.log('All Done')
}
}

phase = 1
clientStart = null

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
	phase = parseInt(fs.readFileSync(`bot${oldBots[oldBots.length - 1]}.lock`, 'utf-8').split(',')[0])
	if(fs.readFileSync(`bot${oldBots[oldBots.length - 1]}.lock`, 'utf-8').split(',').length > 1){
		clientStart = parseInt(fs.readFileSync(`bot${oldBots[oldBots.length - 1]}.lock`, 'utf-8').split(',')[1])
	}
}

fs.readdirSync(__dirname).forEach(file => {
	if(file.indexOf(".lock") !== -1){
		fs.unlink(file)
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
	for(var j=0;j<clientdb.length;j++){
		if(i + 1 >= clientdb[j][3] && i + 1 <= clientdb[j][4]){
			botsActive.push(botdb[i])
			break
		}
	}
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