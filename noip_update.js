#!/usr/bin/env node
const got = require("got");
const os = require("os");
const fs = require("fs");
const debug = false; //Set to true to get extended info about the processing

//Utility functions
//Debug logging
function debugPrint(text) {
	if (debug) console.log(text);
}
//Normal logging
//Logs time as Unix timestamp
function log(text){
	console.log(Date.now() + ": " + text);
}
//Sets the system into after-error state and disables the client
function setErrorState(error) {
	fs.writeFileSync(`${os.userInfo().homedir}/noip.lock`, errorMessages[error]);
}

//An object with generic response messages, from https://www.noip.com/integrate/response
const errorMessages = {
	nohost: "Host you have provided does not exist",
	badauth: "Provided credentials are invalid",
	badagent: "This client has been banned from noip, you can leave an issue on Github",
	"!donator": "You tried to access premium features as standard account",
	"911": "Server error on noip's side"
}

//Request data
//NO-IP data, username is the email
const userEmail = ""; //Your email to use in the userAgent
const username = "";
const password = "";
const domains = [""]; //either FQDNs or groupnames
const updateDomain = "dynupdate.no-ip.com/nic/update"; //Domain to make requests to, from https://www.noip.com/integrate/request
const protocol = ""; //either http or https


debugPrint(`${userEmail}, ${username}, ${password}, ${JSON.stringify(domains)}, ${protocol}, ${updateDomain}`);

//Request details
const userAgent = `AdamsNOIPUpdater/${os.platform() + " " + os.arch() + " " + os.release()}-1.0 ${userEmail}`;
const method = "GET";
const targetURL = `${protocol}${username}:${password}@${updateDomain}?hostname=${domains.join(",")}`;
const headers = {
	Host: `${updateDomain.split("/")[0]}`,
	Authorization: `Basic ${(Buffer.from(username + ":" + password)).toString("base64")}`, //because fuck variables amirite
	"User-Agent": userAgent
}

debugPrint(`${userAgent}\n ${method}\n ${targetURL}`)
debugPrint(JSON.stringify(headers, null, 4));

//Main code
if (fs.existsSync(`${os.userInfo().homedir}/noip.lock`)) {
	log("Error: this client has been disabled. Check logs and correct any errors, after that remove the noip.lock file from your home directory");
	return;
}
log("Starting IP update")
try {
	got(targetURL, {
		method: method,
		retry: 0,
		headers: headers
	}).then((response) => {
		log("Request successful, with code " + response.statusCode);
		debugPrint(response.body);
		const responses = response.body.split(",");
		for (let domainResult of responses) {
			debugPrint(domainResult);
			const responseParts = domainResult.split(" ");
			if (responseParts.length == 1) {
				//Definitely an error according to https://www.noip.com/integrate/response
				log(`Error: ${errorMessages[responseParts[0]]}`);
				if (responseParts[0] != "911") {
					setErrorState(responseParts[0]);
				}
			} else {
				if (responseParts[0] == "good") {
					log(`Success updating IP: ${domainResult}`);
				} else if (responseParts[0] == "nochg") {
					log(`Success: This IP was already in the database: ${domainResult}`);
				} else {
					log(`Unrecognized response: ${domainResult}`);
				}
			}
		}
	});
} catch (exception) {
	if (debug) {
		console.log(exception);
	} else {
		log(`Error when updating: ${exception.message}`)
	}
}
