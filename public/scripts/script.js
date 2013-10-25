"use strict";

var map;
var states = [];
var ib = new InfoBox();

google.maps.event.addListener(ib, 'closeclick', function() {
  mapUtil.clearSelectedState();
});

function initializeGraph(data) {
  nv.addGraph(function() {
    var chart = nv.models.stackedAreaChart()
                  .x(function(d) { return d.x; })
                  .y(function(d) { return d.y; })
                  .useInteractiveGuideline(true)
                  .controlsData(['Stacked', 'Expanded'])
                  .controlLabels({stacked: 'Empilhado', stream: 'Stream', expanded: 'Expandido'})
                  .tooltips(true)
                  .clipEdge(true);


    chart.xAxis.tickFormat(function(d) { return d3.time.format('%m-%Y')(new Date(d)) });
    chart.yAxis.axisLabel("Número de acidentes");
    chart.yAxis.tickFormat(d3.format(',.0f'));
    chart.margin({left: 80});

  $('#chart-overlay svg').empty();
  d3.select('#chart-overlay svg')
    .append("text")
    .attr("x", 20)
    .attr("y", 20)
    .attr("text-anchor", "middle")  
    .text(mapUtil.selectedState.name);

    d3.select('#chart-overlay svg')
        .datum(data)
        .transition().duration(500)
        .call(chart);


    nv.utils.windowResize(chart.update);

    return chart;
  });
}

var fusionTableWrapper = {
  call: function(tableId, fields, where, callbackName) {
    var script = document.createElement('script');
    var url = ['https://www.googleapis.com/fusiontables/v1/query?'];
    url.push('sql=');
    var query = 'SELECT ' + fields.join(', ') + ' FROM ' + tableId;
    if(where) {
      query += ' WHERE ' +  where;
    }

    var encodedQuery = encodeURIComponent(query);
    url.push(encodedQuery);
    url.push('&callback=' + callbackName);
    url.push('&key=AIzaSyCmJqyDLGq5UEcn0hpFO4hVhb5q74gVyLw');
    script.src = url.join('');
    var body = document.getElementsByTagName('body')[0];
    body.appendChild(script);
  }
};

var mapUtil = {
  newCoordinates: function(polygon) {
    var newCoordinates = [];
    var coordinates = polygon['coordinates'][0];

    for (var i in coordinates) {
      newCoordinates.push(
          new google.maps.LatLng(coordinates[i][1], coordinates[i][0]));
    }
    return newCoordinates;
  },
  selectState: function(state) {
      this.selectedState = state;
  },
  isSelected: function(stateName) {
    return this.selectedState && this.selectedState.name === stateName;
  },
  clearSelectedState: function() {
    if(!this.selectedState) return; //none currently selected

    var _self = this;
    var state = _.find(states, function(s) { return s.name === _self.selectedState.name; });
    state.polygon.setOptions({strokeWeight: 1, strokeColor: '#555555'});
    this.selectedState = null;
  },
  getRGB: function(value) {
    var rainbow = new Rainbow(); 
    rainbow.setNumberRange(1246, 163111);  //rainbow.setSpectrum('#FFFFB2', '#FECC5C', '#FD8D3C', '#E31A1C'); //yellow
    rainbow.setSpectrum('#FFFFCC', '#C2E699', '#78C679', '#238443'); //greens
    return '#' + rainbow.colourAt(value);
  },
  toggleStatesLayer: function(on) {
    _.each(states, function(s){
      s.polygon.setMap(on ? map : null);
    });

    if(!on){
      $('#map-canvas').css('height', '100%');
      //$('#chart-overlay').hide();
      ib.close();
      google.maps.event.trigger(map, 'resize');
    }
  },
  toggleRoadsLayer: function(on) {
    this.roadsLayer.setMap(on ? map : null);
  }
};

function dateRangeChanged(e, data) {
  var rsp = fusionTableWrapper.lastResponse;
  if(rsp) {
    var data = parseData(rsp, slider.getRange());
    initializeGraph(data);
  }
}

function initialize() {
  google.maps.visualRefresh = true;

  spinner.init('map-spinner');
  
  // slider change binding 
  $('#slider').on('valuesChanged', dateRangeChanged);

  map = new google.maps.Map(document.getElementById('map-canvas'), {
    center: new google.maps.LatLng(-14.989911309819053, -48.35657244067755),
    zoom: 5,
    minZoom: 4,
    maxZoom: 10,
    mapTypeControl: false,
    panControl: false,
    zoomControl: true,
    zoomControlOptions: {
        style:google.maps.ZoomControlStyle.DEFAULT,
        position: google.maps.ControlPosition.LEFT_CENTER
    },
    scaleControl: true,
    streetViewControl: false,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  });

  mapUtil.roadsLayer = new google.maps.FusionTablesLayer({
    query: {
      select: "geom",
      from: "1KOwur7icdQlzaXN3yJ7QB9zMyxxMhSIkGIjuEEM",
    },
    options: {
      styleId: 2,
      templateId: 2
    },
    heatmap: {enabled: false}
  });

  var tableId = '189pHpNhpAHtZcI-cFMmT1foqdJrWSdLMIX70hXM';
  var fields = ['Text', 'Location', 'total'];

  // FIX IE duença
  var estados = [
    'AC',
    'AL',
    'AM',
    'AP',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MG',
    'MS',
    'MT',
    'PA',
    'PB',
    'PE',
    'PI',
    'PR',
    'RJ',
    'RN',
    'RO',
    'RR',
    'RS',
    'SC',
    'SE',
    'SP',
    'TO'
  ]

  for (var i = 0; i < estados.length; i++) {
    fusionTableWrapper.call(tableId, fields, "Text = '" + estados[i] + "'", 'drawMap');
  }
}


function drawMap(data) {
  var rows = data['rows'];
  for (var i in rows) {
    var stateName = rows[i][0];
    var geometries = rows[i][1]['geometries'];
    var total = parseInt(rows[i][2]);

    var coordinates = [];
    if (geometries) {
      for (var j in geometries) {
        coordinates.push(mapUtil.newCoordinates(geometries[j]));
      }
    } else {
      coordinates = mapUtil.newCoordinates(rows[i][1]['geometry']);
    }

    var state = new google.maps.Polygon({
      paths: coordinates,
      strokeColor: '#555555',
      strokeOpacity: 0.6,
      strokeWeight: 1,
      fillColor: mapUtil.getRGB(total),
      fillOpacity: 0.6,
      name: stateName
    });

    states.push({
      name: stateName,
      polygon: state
    });

    google.maps.event.addListener(state, 'mouseover', function() {
      this.setOptions({strokeWeight: 2.5});
    });

    google.maps.event.addListener(state, 'mouseout', function() {
      if(mapUtil.isSelected(this.name)) { return; }
      this.setOptions({strokeWeight: 1});
    });

    google.maps.event.addListener(state, 'click', function(e) {
      var tableId = '1za9lKRkUO7WKwUhdwcLpAa8CDZLqKgvtHM7YCk0';
      var fields = ['ano', 'mes', 'causaAcidente', 'acidentes'];
      var where = "local = '" + this.name + "'";

      // highlight clicked state
      _.each(states, function(s) { s.polygon.setOptions({strokeWeight: 1, strokeColor: '#555555'});});
      this.setOptions({strokeWeight: 2.5, strokeColor: '#000000'});

      mapUtil.selectState({name: this.name, clickEvent: e});
      ib.close(); // fix IE bug ;)
      fusionTableWrapper.call(tableId, fields, where, 'openGraphWindow');
    });

    state.setMap(map);
  }

  spinner.stop('map-spinner');
}

function parseData(fusionTableResponse, range) {
  // fusionTableResponse.rows => ano, mes, causa, total
  var causas = _.uniq(_.map(fusionTableResponse.rows, function(r){ return r[2] || 'desconhecido'; }));
  var causasData = _.map(causas, function(causa) {
    var causaEntries = _.filter(fusionTableResponse.rows, function(r) {
      return r[2] == causa;
    });

    var dataPoints = _.map(causaEntries, function(e){
      var time = e[0] + e[1];
      var totalAcidentes = e[3];
      return [time, totalAcidentes];
    });

    var rangeData = [];
    // for each month within the range
    for(var year=range.min.year; year <= range.max.year; year++) {
      for(var month=range.min.month; month <= 12; month++) {
        if(year === range.max.year && month > range.max.month) break;

        var dateTimeStr = (month<10 ? '0' + month : month) + '-' + year;
        var dateTime = d3.time.format("%m-%Y").parse(dateTimeStr);

        var val = _.find(causaEntries, function(c){
          return c[0] == year.toString() && c[1] == month.toString();
        });
        
        var total = val ? parseInt(val[3]) : 0;

        rangeData.push({ 
          x: dateTime.getTime(), 
          y: total 
        });
      }
    }

    return {
      key: causa, 
      values: rangeData
    };
  });

  return causasData;
}

function openGraphWindow(fusionTableResponse) {
  fusionTableWrapper.lastResponse = fusionTableResponse;
  showPopUp(mapUtil.selectedState.clickEvent, fusionTableResponse.rows);

  window.google.maps.event.addListenerOnce(ib, "domready", function () {
    $('#grafico').magnificPopup({
      type:'inline',
      callbacks: {
        open: function(){
          slider.init();
          initializeGraph(parseData(fusionTableResponse, slider.getRange()));
        },
        close: function() {
          //destroyGraph??????
          slider.destroy();
        }
      }
    });
  });
};

var showRoads = false;
function changeViews() {
  var newVal = $('#showRoads').is(':checked');
  if(showRoads == newVal) return;
  else { showRoads = newVal };

  mapUtil.clearSelectedState();
  mapUtil.toggleRoadsLayer(showRoads);
  mapUtil.toggleStatesLayer(!showRoads);
}

function showPopUp(clickEvent, rows) {
  var marker = new google.maps.Marker({
    map: map,
    draggable: true,
    position: clickEvent.latLng,
    visible: false
  });

  var total = _.reduce(rows, function(t, row){ return t + row[3]; }, 0);

  var causes = _.uniq(_.map(rows, function(r){ return r[2] || 'desconhecido'; }));
  var causesTotals = _.map(causes, function(cause) {
    var causeData = _.filter(rows, function(r){ return r[2] == cause; });
    var causeTotal = _.reduce(causeData, function(t, v){ return t + v[3]; }, 0);
    var percentage = ((causeTotal/total) * 100).toFixed(2);
    return {cause: cause, percentage: percentage};
  });

  var top5  = _.sortBy(causesTotals, function(c){ return -c.percentage; }).slice(0, 5);

  var popupData = {
    name: mapUtil.selectedState.name,
    accidents: total,
    deaths: 666 //TODO unknown
  };

  var boxText = document.createElement("div");
  boxText.style.cssText = "border: 1px solid #2980b9; border-radius: 3px; margin-top: 8px; margin-bottom: 60px; background: #3498db; color:white; padding: 5px;";

  var html = [];
  html.push('<span class="column column-left" >');
  html.push('  <h2>' + popupData.name + '</h2>');
  html.push('  <img class="icon" src="images/caraccident.png" />');
  html.push('  <span class="number">' + popupData.accidents + '</span>');
  html.push('  <img class="icon" src="images/dead.png" />');
  html.push('  <span class="number">' + popupData.deaths + '</span><br>');
  html.push('</span>');
  html.push('<span class="column column-right" >');
  _.each(top5, function(t){
    html.push('  <span class="causa"><span class="percentage">' + t.percentage + '%</span> ' + t.cause);
    html.push('  <span class="progress-bar"><span class="progress-color" style="width: ' + t.percentage + '%"' + '></span></span>');
    html.push('  </span>');
  });
  html.push('</span>');
  html.push('<a href="#chart-overlay" id="grafico">Veja mais informações</a>');

  boxText.innerHTML = html.join('');

  var myOptions = {
    content: boxText,
    disableAutoPan: false,
    maxWidth: 0,
    pixelOffset : clickEvent.pixelOffset,
    zIndex: null,
    boxStyle: {
      opacity: 0.92
    },
    closeBoxMargin: "10px 2px 2px 2px",
    closeBoxURL: "images/close.png",
    infoBoxClearance: new google.maps.Size(1, 1),
    isHidden: false,
    pane: "floatPane",
    enableEventPropagation: false
  };

  //ib.close();
  ib.setOptions(myOptions);
  ib.open(map, marker);
}

google.maps.event.addDomListener(window, 'load', initialize);
