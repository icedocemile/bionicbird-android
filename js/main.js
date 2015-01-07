
// Application object.
var app = {};

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

  // For development only.
  // toggle_scan(true);
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
  read_value('steering', function(data) {
    console.log('read steering: ' + JSON.prune(data));
    $("#steering").val(data[0] || 50);
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
  var thrust = $("#thrust");
  var steering = $("#steering");
  var update = function() {
    var val = new Uint8Array([
      parseInt(steering.val()),
      parseInt(thrust.val()),
    ]);
    write_value('thruster', val);
  };
  thrust.change(update);
  steering.change(update);
  $('#stop').click(function() {
    thrust.val(0);
    thrust.change();
  });
  // thrust.change(function() {
  //   var val = new Uint8Array([parseInt(thrust.val())]);
  //   console.log(JSON.prune(val));
  //   write_value('thruster', val);
  // });
  // steering.change(function() {
  //   var val = new Uint8Array([parseInt(steering.val())]);
  //   write_value('steering', val);
  // });
  // $("#thrust").on("slidestart", function(ev) {
  //   console.log($("#thrust").slider().val());
  // });
});
