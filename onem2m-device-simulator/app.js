var express = require('express');
var request = require('request');
var hashmap = require('hashmap');
var config = require('config');
var path = require('path');
var bodyParser = require('body-parser');
const readline = require('readline');

var app = express();
var map = new hashmap();

app.use(bodyParser.json());
app.use(express.json());

var port = 8081;
app.listen(port, () => {
	console.log('Simulator API listening on port ' + port)
})

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname + '/templates/index.html'));
})
app.get('/test', (req, res) => {
	res.sendFile(path.join(__dirname + '/templates/test.html'));
})

/**
 * Type 목록 템플릿 가져오기
 */
app.get('/templates', (req, res) => {
	res.send(templates);
})

/**
 * 디바이스 목록 가져오기
 */
app.get('/devices', (req, res) => {
	var devices = [];
	map.forEach((value, key) => {
		devices.push({
			typeIndex: value.typeIndex,
			name: key,
			type: value.type,
			data: value.data,
			icon: value.icon,
			unit: value.unit,
			stream: value.stream
		});
	});

	res.send(devices);
})

/**
 * 디바이스 삭제
 */
app.delete('/devices/:name', (req, res) => {
	map.delete(req.params.name);
	deleteAE(req.params.name);

	res.sendStatus(204);
})

/**
 * 디바이스 추가
 */
app.post('/devices/:name', (req, res) => {
	let typeIndex = req.query.typeIndex;
	let name = req.params.name;
	let value = req.query.value;

	updateDevice(typeIndex, name, value);

	res.sendStatus(201);
})

/**
 * 디바이스 추가
 */
app.post('/devices', (req, res) => {
	let typeIndex = req.query.type;
	let name = req.query.name;
	var object = {
		typeIndex: typeIndex,
		type: templates[typeIndex].type,
		data: random(templates[typeIndex].min, templates[typeIndex].max),
		icon: templates[typeIndex].icon,
		unit: templates[typeIndex].unit,
		stream: templates[typeIndex].stream
	}
	map.set(name, object);

	createAE(name, typeIndex);

	res.sendStatus(201);
})

/**
 * 구독 알림 api 추가
 * @param { string } name 
 * @param { * } typeIndex 
 */
function listen(name, typeIndex) {
	app.post('/' + name, (req, res) => {
		console.log("\n[NOTIFICATION]")
		console.log(req.body["m2m:sgn"].nev.rep["m2m:cin"]);

		var content = req.body["m2m:sgn"].nev.rep["m2m:cin"].con;

		console.log(templates[typeIndex].type + "::" + name + " is switched to " + content);

		var object = {
			typeIndex: typeIndex,
			type: templates[typeIndex].type,
			data: content,
			icon: templates[typeIndex].icon,
			unit: templates[typeIndex].unit,
			stream: templates[typeIndex].stream
		}


		map.set(name, object);

		res.sendStatus(200);
	});
}

var cseurl = "http://" + config.cse.ip + ":" + config.cse.port + "/~/" + config.cse.id + "/" + config.cse.name
var deviceTypes = new hashmap();
var templates = config.templates;
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function createAE(name, typeIndex) {
	console.log("\n[REQUEST]:: Create AE");

	var originator = "Cae-" + name;
	var method = "POST";
	var uri = cseurl;
	var resourceType = 2;
	var requestId = Math.floor(Math.random() * 10000);
	var rr = "false";
	var poa = "";
	if (templates[typeIndex].stream == "down") {
		rr = "true";
		poa = "http://127.0.0.1:" + port + "/" + name
		listen(name, typeIndex)
	}
	var representation = {
		"m2m:ae": {
			"rn": name,
			"api": "app.company.com",
			"rr": rr,
			"poa": [poa]
		}
	};

	console.log(method + " " + uri);
	console.log(representation);

	var options = {
		uri: uri,
		method: method,
		headers: {
			"X-M2M-Origin": originator,
			"X-M2M-RI": requestId,
			"Content-Type": "application/json;ty=" + resourceType
		},
		json: representation
	};

	request(options, (error, response, body) => {
		console.log("[RESPONSE]:: Create AE");

		if (error) {
			console.log(error);
		} else {
			console.log(response.statusCode);
			console.log(body);

			if (response.statusCode == 409) {
				resetAE(name, typeIndex);
			} else {
				createDataContainer(name, typeIndex);
			}
		}
	});
}

function deleteAE(name) {
	console.log("\n[REQUEST]:: Delete AE");

	var originator = "Cae-" + name;
	var method = "DELETE";
	var uri = cseurl + "/" + name;
	var requestId = Math.floor(Math.random() * 10000);

	console.log(method + " " + uri);

	var options = {
		uri: uri,
		method: method,
		headers: {
			"X-M2M-Origin": originator,
			"X-M2M-RI": requestId,
		}
	};

	request(options, (error, response, body) => {
		console.log("[RESPONSE]:: Delete AE");

		if (error) {
			console.log(error);
		} else {
			console.log(response.statusCode);
			console.log(body);

		}
	});
}

function resetAE(name, typeIndex) {
	console.log("\n[REQUEST]:: Reset AE");

	var originator = "Cae-" + name;
	var method = "DELETE";
	var uri = cseurl + "/" + name;
	var requestId = Math.floor(Math.random() * 10000);

	console.log(method + " " + uri);

	var options = {
		uri: uri,
		method: method,
		headers: {
			"X-M2M-Origin": originator,
			"X-M2M-RI": requestId,
		}
	};

	request(options, (error, response, body) => {
		console.log("[RESPONSE]:: Reset AE");

		if (error) {
			console.log(error);
		} else {
			console.log(response.statusCode);
			console.log(body);

			createAE(name, typeIndex);
		}
	});
}

function createDataContainer(name, typeIndex) {
	console.log("\n[REQUEST]:: Create Data Container");

	var originator = "Cae-" + name;
	var method = "POST";
	var uri = cseurl + "/" + name;
	var resourceType = 3;
	var requestId = Math.floor(Math.random() * 10000)
	var representation = {
		"m2m:cnt": {
			"rn": "data",
			"mni": 100
		}
	};

	console.log(method + " " + uri);
	console.log(representation);

	var options = {
		uri: uri,
		method: method,
		headers: {
			"X-M2M-Origin": originator,
			"X-M2M-RI": requestId,
			"Content-Type": "application/json;ty=" + resourceType
		},
		json: representation
	};

	request(options, (error, response, body) => {
		console.log("[RESPONSE]:: Create Data Container");

		if (error) {
			console.log(error);
		} else {
			console.log(response.statusCode);
			console.log(body);

			createContentInstance(name, typeIndex, fire);

			if (templates[typeIndex].stream == "up") {
				var fire = setInterval(() => {
					createContentInstance(name, typeIndex, fire);
				}, templates[typeIndex].freq * 1000);
			} else if (templates[typeIndex].stream == "down") {
				createSubscription(name, typeIndex)
			}
		}
	});
}

function updateDevice(typeIndex, name, data) {
	var originator = "Cae-" + name;
	var method = "POST";
	var uri = cseurl + "/" + name + "/data";
	var resourceType = 4;
	var requestId = Math.floor(Math.random() * 10000);
	var con = data;

	var object = {
		typeIndex: typeIndex,
		type: templates[typeIndex].type,
		data: con,
		icon: templates[typeIndex].icon,
		unit: templates[typeIndex].unit,
		stream: templates[typeIndex].stream
	}

	console.log("\n[REQUEST]:: Update Device");

	map.set(name, object);

	var representation = {
		"m2m:cin": {
			"con": con
		}
	};

	console.log(method + " " + uri);
	console.log(representation);

	var options = {
		uri: uri,
		method: method,
		headers: {
			"X-M2M-Origin": originator,
			"X-M2M-RI": requestId,
			"Content-Type": "application/json;ty=" + resourceType
		},
		json: representation
	};

	request(options, (error, response, body) => {
		console.log("[RESPONSE]:: Update Device");

		if (error) {
			console.log(error);
		} else {
			console.log(response.statusCode);
			console.log(body);
		}
	});
}

function createContentInstance(name, typeIndex, fire) {
	var originator = "Cae-" + name;
	var method = "POST";
	var uri = cseurl + "/" + name + "/data";
	var resourceType = 4;
	var requestId = Math.floor(Math.random() * 10000);
	var con = random(templates[typeIndex].min, templates[typeIndex].max);

	var object = {
		typeIndex: typeIndex,
		type: templates[typeIndex].type,
		data: con,
		icon: templates[typeIndex].icon,
		unit: templates[typeIndex].unit,
		stream: templates[typeIndex].stream
	}

	if (map.has(name)) {
		console.log("\n[REQUEST]:: Create Content Instance");

		map.set(name, object);

		var representation = {
			"m2m:cin": {
				"con": con
			}
		};

		console.log(method + " " + uri);
		console.log(representation);

		var options = {
			uri: uri,
			method: method,
			headers: {
				"X-M2M-Origin": originator,
				"X-M2M-RI": requestId,
				"Content-Type": "application/json;ty=" + resourceType
			},
			json: representation
		};

		request(options, (error, response, body) => {
			console.log("[RESPONSE]:: Create Content Instance");
			if (error) {
				console.log(error);
			} else {
				console.log(response.statusCode);
				console.log(body);
			}
		});
	} else {
		clearInterval(fire);
	}
}

function createSubscription(name, typeIndex) {
	console.log("\n[REQUEST]:: Create Subscription");

	var originator = "Cae-" + name;
	var method = "POST";
	var uri = cseurl + "/" + name + "/data";
	var resourceType = 23;
	var requestId = Math.floor(Math.random() * 10000);;
	var representation = {
		"m2m:sub": {
			"rn": "sub",
			"nu": ["/server/" + "Cae-" + name],
			"nct": 2,
			"enc": {
				"net": 3
			}
		}
	};

	console.log(method + " " + uri);
	console.log(representation);

	var options = {
		uri: uri,
		method: method,
		headers: {
			"X-M2M-Origin": originator,
			"X-M2M-RI": requestId,
			"Content-Type": "application/json;ty=" + resourceType
		},
		json: representation
	};

	request(options, (error, response, body) => {
		console.log("[RESPONSE]:: Create Subscription");

		if (error) {
			console.log(error);
		} else {
			console.log(response.statusCode);
			console.log(body);
		}
	});
}

function random(min, max) {
	return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * 테스트용 api
 */
 const testConfig = {
	om2mPort: 8080,
	cseID: "server",
	cseName: "server",
	get defaultURL() {
		return `http://localhost:${this.om2mPort}`;
	},
	resourceType: {
		ae: 2,
		container: 3,
		cin: 4,
		subscription: 23,
	},
	defaultOriginator: "CAE",
	requestId: Math.floor(Math.random() * 10000),
	appID: "App-test",
}

/**
 * AE, ae, application entity 생성
 */
app.post('/ae/new', (req, res) => {
	const { ae } = req.body;

	const uri = testConfig.defaultURL + "/~/" + testConfig.cseID + "/" + testConfig.cseName 
	const headers = {
		"X-M2M-Origin": testConfig.defaultOriginator + "-" + ae,
		"X-M2M-RI": testConfig.requestId,
		"Content-Type": "application/json;ty=" + testConfig.resourceType.ae
	}
	const param = {
		"m2m:ae": {
			rn: ae,
			api: testConfig.appID,
			rr: true,
			poa: [`http://127.0.0.1:8081/${ae}`]
		}
	};
	const options = {
		uri: uri,
		method: "POST",
		headers: headers,
		json: param,
	};

	request(options, (error, response, body) => {
		console.log("[RESPONSE]:: AE 생성");

		if (error) {
			console.log("에러", error);
		} else {
			console.log(response.statusCode);
			console.log(body);

			if (response.statusCode == 409) {
				console.log(response.statusCode);
			} else {
				console.log("AE 생성 완료")
				createListener(ae);
			}
		}
	});

	res.sendStatus(201);
})

/**
 * cnt, container, data container 생성
 * mni는 컨테이너에 생성 가능한 cin 갯수
 */
app.post('/container', (req, res) => {
	console.log("[REQUEST]:: 컨테이너 생성");

	const { ae, container } = req.body;
	const uri = testConfig.defaultURL + "/~/" + testConfig.cseID + "/" + testConfig.cseName + "/" + ae;
	const headers = {
		"X-M2M-Origin": testConfig.defaultOriginator + "-" + ae,
		"X-M2M-RI": testConfig.requestId,
		"Content-Type": "application/json;ty=" + testConfig.resourceType.container,
	}
	const param = {
		"m2m:cnt": {
			rn: container,
			api: testConfig.appID,
			mni: 100,
		}
	};
	const options = {
		uri: uri,
		method: "POST",
		headers: headers,
		json: param,
	};

	request(options, (error, response, body) => {
		console.log("[RESPONSE]:: Container 생성");

		if (error) {
			console.log("에러", error);
		} else {
			console.log(response.statusCode);
			console.log(body);

			if (response.statusCode == 409) {
				console.log(response.statusCode);
			} else {
				console.log("Container 생성 완료")
			}
		}
	});

	res.sendStatus(201);
})

/**
 * cin, content instance, contentInstance 생성
 * con에 객체를 담아 보낼 경우엔 그냥 보낼 수 없음, 또한 한글 사용 불가
 */
app.post('/cin', (req, res) => {
	console.log("[REQUEST]::CIN 생성")

	const { ae, container, cin } = req.body;
	const uri = testConfig.defaultURL + "/~/" + testConfig.cseID + "/" + testConfig.cseName + "/" + ae + "/" + container;
	const headers = {
		"X-M2M-Origin": testConfig.defaultOriginator + "-" + ae,
		"X-M2M-RI": testConfig.requestId,
		"Content-Type": "application/json;ty=" + testConfig.resourceType.cin
	}
	const param = {
		"m2m:cin": {
			con: cin,
		}
	};
	const options = {
		uri: uri,
		method: "POST",
		headers: headers,
		json: param,
	};

	request(options, (error, response, body) => {
		console.log("[RESPONSE]::CIN 생성");

		if (error) {
			console.log("에러", error);
		} else {
			console.log(response.statusCode);
			console.log(body);

			if (response.statusCode == 409) {
				console.log("CIN 생성 실패", response.statusCode);
			} else {
				console.log("CIN 생성 성공");
			}
		}
	});

	res.sendStatus(201);
})

/**
 * 구독, subscribe, subscription
 * 새로운 cin을 추가할 경우 ae의 poa에 정의된 주소로 새 cin 정보를 보내줌
 */
app.post('/subs', (req, res) => {
	console.log("[REQUEST]::구독하기")
	const { ae, container } = req.body;
	const uri = testConfig.defaultURL + "/~/" + testConfig.cseID + "/" + testConfig.cseName + "/" + ae + "/" + container;
	const headers = {
		"X-M2M-Origin": testConfig.defaultOriginator + "-" + ae,
		"X-M2M-RI": testConfig.requestId,
		"Content-Type": "application/json;ty=" + testConfig.resourceType.subscription
	}
	const param = {
		"m2m:sub": {
			"rn": "sub",
			"nu": [`/server/${testConfig.defaultOriginator}-${ae}`],
			"nct": 2,
			"enc": {
					"net": 3
			}
	}
	}
	const options = {
		uri: uri,
		method: "POST",
		headers: headers,
		json: param,
	};

	request(options, (error, response, body) => {
		console.log("[RESPONSE]::구독하기");

		if (error) {
			console.log("에러", error);
		} else {
			console.log(response.statusCode);
			console.log(body);

			if (response.statusCode == 409) {
				console.log("구독 실패", response.statusCode);
			} else {
				console.log("구독 완료");
			}
		}
	});

	res.sendStatus(201);
});

function createListener(ae) {
	console.log('listener 추가')

	app.post('/' + ae, (req, res) => {
		console.log('구독 선물이 도착하였습니다.');
		const content = req.body["m2m:sgn"].nev.rep["m2m:cin"].con;

		console.log('구독 이벤트 선물', content);
	})
}