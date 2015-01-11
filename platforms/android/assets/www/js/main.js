
// Application object.
var app = {};
var steeringValue = 50; //Init
var throttleValue = 0;
var started = false; //Is control started. Toggle button home.

/** BLE plugin, is loaded asynchronously so the
	variable is redefined in the onDeviceReady handler. */
var ble = null;

// Application Constructor
//
// Bind any events that are required on startup. Common events are:
// 'load', 'deviceready', 'offline', and 'online'.
app.initialize = function()
{
	document.addEventListener('deviceready', this.onDeviceReady, false);
};

// deviceready Event Handler
//
// The scope of 'this' is the event. In order to call the 'receivedEvent'
// function, we must explicity call 'app.receivedEvent(...);'
app.onDeviceReady = function()
{
	// The plugin was loaded asynchronously and can here be referenced.
	ble = evothings.ble;
	navigator.accelerometer.watchAcceleration(onSuccess, onError, {frequency: 200});
  // For development only.
  // toggle_scan(true);
};
function resetValues() {
	throttleValue = 0;
	steeringValue = 50;
	update();
}

function onSuccess(acceleration) {
    //Need to map this to steering values acceleration.x between 6 (left) and -6 (right)
	acceleration.x = -acceleration.x;
	acceleration.y = -acceleration.y;
	if(acceleration.x < -6) {
		acceleration.x = -6;
	} else if(acceleration.x > 6) {
		acceleration.x = 6;
	}
	if(acceleration.y <= -6) {
		acceleration.y = -6;
	} else if(acceleration.y >= 4) {
		acceleration.y = 4;
	}
	//Range = 12. Offset = 6;
	offset = 6;
	var rangedValueX = acceleration.x + offset;
	var percentValueX = rangedValueX * 99 / 12;
	//Throttle
	var percentValueY = (acceleration.y + 6) * 254 / 10;
	throttleValue = percentValueY;
	steeringValue = percentValueX;
	
	//console.log(throttleValue);
	//console.log(steeringValue);
	//Update to bird
	if(started) {
		update();
	}
};

function onError() {
    console.log('onError!');
};

var errorCB = function(err) {
  console.log('error: ' + JSON.prune(err));
};

var got_device = function(r) {
  console.log('got device ' + r.address);
  $('#deviceList').append(
      '<li><button class="deviceBtn" data-addr="' + r.address + '">'
      + r.address + ' ' + r.rssi + ' ' + r.name + '</button></li>');
  $('.deviceBtn').click(function() {
    toggle_scan(false);
    $('.deviceBtn').prop('disable', true);
    ble.connect(this.dataset.addr, connected, errorCB);
  });
  // if (r.address == '54:4A:16:54:EE:F0') {
  //   $('.deviceBtn').last().click();
  // }
};

var connected = function(info) {
  $('#devices').hide();
  console.log('Connection state: ' + ble.connectionState[info.state]);
  ble.readAllServiceData(
      info.deviceHandle,
      got_service_data.bind(null, info.deviceHandle),
      errorCB);
};

app.device_handle = null;
app.bird_chrs = {
  thruster: null,
  steering: null,
  z: null,
  other: null,
  battery: null,
};
var got_service_data = function(deviceHandle, services) {
  var first_custom_char = services[services.length-1].characteristics[0];
  if (first_custom_char.uuid != "0000acc1-0000-1000-8000-00805f9b34fb") {
    ble.close(deviceHandle);
    $('.deviceBtn').prop('disable', false);
    return;
  }
  app.device_handle = deviceHandle;
  var bird_service = services[services.length-1];
  services.forEach(function(serv) {
    if (uuid[serv.uuid] == 'BATTERY') {
      serv.characteristics.forEach(function(chr) {
        if (uuid[chr.uuid] == 'BATTERY_MEASUREMENT') {
          app.bird_chrs.battery = chr;
        }
      });
    } else if (uuid[serv.uuid] == 'BIONIC_BIRD') {
      serv.characteristics.forEach(function(chr) {
        if (uuid[chr.uuid] == 'THRUSTER') {
          app.bird_chrs.thruster = chr;
        } else if (uuid[chr.uuid] == 'STEERING') {
          app.bird_chrs.steering = chr;
        } else if (uuid[chr.uuid] == 'Z_CONTROL') {
          // Doesn't do anything on a v1 bird.
          app.bird_chrs.z = chr;
        } else if (uuid[chr.uuid] == 'OTHER') {
          // Doesn't do anything on a v1 bird.
          app.bird_chrs.other = chr;
        }
      });
    }
  });
  read_value('thruster', function(data) {
    console.log('read thruster: ' + JSON.prune(data));
    $("#thrust").val(data[0] || 0);
  });
  
  // read_value('battery', function(data) {
  //   console.log('read battery ' + JSON.prune(data));
  // });
  // subscribe to battery changes
  // ble.enableNotification(app.device_handle, app.bird_chrs.battery.handle,
  //     function(data) {
  //       console.log('battery ' + JSON.prune(ble.fromUtf8(data)));
  //     }, errorCB);
  $('#controls').show();
};

var write_value = function(type, data) {
  // console.log('writing... ' + JSON.prune(app.bird_chrs[type].uuid)
  //     + ' <- ' + JSON.prune(data));
  ble.writeCharacteristic(
      app.device_handle, app.bird_chrs[type].handle,
      data, null, errorCB);
};

var read_value = function(type, cb) {
  ble.readCharacteristic(
      app.device_handle, app.bird_chrs[type].handle,
      cb, errorCB);
};

var clear_devices = function() {
  $("#deviceList").children()./*nextAll().*/remove();
  $('#devices').show();
  $('#controls').hide();
};

app.scanning = false;
var toggle_scan = function(scanning) {
  app.scanning = scanning;
  var scanBtn = $('#scan')[0];
  scanBtn.innerText = scanBtn.dataset[scanning];
  if (scanning) {
    console.log('scanning');
    clear_devices();
    ble.startScan(got_device, errorCB);
    // console.log(JSON.prune(arguments.length));
	  // app.startLeScan();
  } else {
    ble.stopScan();
  }
}
 var thrust = $("#thrust");
var update = function() {
    var val = new Uint8Array([
      parseInt(steeringValue),
      parseInt(throttleValue),
    ]);
    write_value('thruster', val);
  };

$(document).ready( function() {
  clear_devices();
  $("#reset").click(function() {
    var btns = $("button");
    btns.prop('disabled', true);
    clear_devices();
    ble.reset(function() {
      toggle_scan(false);
      btns.prop('disabled', false);
    });
  });
  $("#scan").click(function() {
    toggle_scan(!app.scanning);
  });
  $("#flying").click(function() {
    started = !started;
	var flyingBtn = $('#flying')[0];
	flyingBtn.innerText = flyingBtn.dataset[started];
	resetValues();
  });
});

