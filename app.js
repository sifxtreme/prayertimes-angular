angular.module('prayerApp', ['google.places'])

	.factory('TimezoneSearcher', ['$http', '$q', function($http, $q){

		return {
			getTimeZone: function(latitude, longitude, timestamp){
				var deferred = $q.defer();

				var url = "https://maps.googleapis.com/maps/api/timezone/json?location=" + latitude + "," + longitude + "&timestamp="+timestamp;

				$http.get(url)
				.success(function(data, status){

					deferred.resolve({
						data: data
					});

				})
				.error(function(data, status){
					console.log(data);
					console.log(status);
				})

				return deferred.promise;
			}
		}
	}])
	.controller('prayerCtrl', ['$scope', '$http', '$timeout', '$interval', 'TimezoneSearcher', function($scope, $http, $timeout, $interval, TimezoneSearcher){

		function setCookie(cname, cvalue, exdays) {
		  var d = new Date();
		  d.setTime(d.getTime() + (exdays*24*60*60*1000));
		  var expires = "expires="+d.toUTCString();
		  document.cookie = cname + "=" + cvalue + "; " + expires;
		}

		function getCookie(cname) {
			var name = cname + "=";
			var ca = document.cookie.split(';');
			for(var i=0; i<ca.length; i++) {
				var c = ca[i];
				while (c.charAt(0)==' ') c = c.substring(1);
				if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
			}
			return "";
		}



		$scope.isDateAvailable = true;
		var dateAvailable = function(){
			var elem = document.createElement('input');
      elem.setAttribute('type', 'date');
      if (elem.type === 'text') {
				$scope.isDateAvailable = false;
      }
		};

		$scope.$watch("newDate", function(newVal, oldVal){
			if(typeof newVal !== "undefined"){
				$scope.currentDay = newVal;
				getPrayerTimes($scope.currentDay, $scope.latitude, $scope.longitude, $scope.prayerOffset);
			}
		})

		var timeZone = function(){
			TimezoneSearcher.getTimeZone( $scope.latitude, $scope.longitude, Date.now()/1000 ).then(
			function(results){
				var newOffset = (results.data.rawOffset + results.data.dstOffset) / 3600
				if($scope.initialPrayerOffset != newOffset){
					$scope.isCurrentLocation = false;
				}
				else{
					$scope.isCurrentLocation = true;
				}
				getPrayerTimes($scope.currentDay, $scope.latitude, $scope.longitude, newOffset);
				$scope.prayerOffset = newOffset;
			},
			function(error){
				console.log("error");
				getPrayerTimes($scope.currentDay, $scope.latitude, $scope.longitude, $scope.prayerOffset);
			})
		}

		$scope.$watch("place", function(newVal, oldVal){
			if(typeof newVal == "object"){
				$scope.myLocation = newVal.name;
				$scope.latitude = newVal.geometry.location.lat();
				$scope.longitude = newVal.geometry.location.lng();

				setCookie("prayer_name", $scope.myLocation, 14);
				setCookie("prayer_lat", $scope.latitude, 14);
				setCookie("prayer_long", $scope.longitude, 14);

				timeZone();
			}
		})

		var colors = {
			Fajr: { start: {r: 154, g: 94, b: 247}, end: {r: 247, g: 145, b: 111} },
			Sunrise: { start: {r: 247, g: 145, b: 111}, end: {r: 185, g: 228, b: 246} },
			Dhuhr: { start: {r: 185, g: 228, b: 246}, end: {r: 63, g: 169, b: 245} },
			Asr: { start: {r: 63, g: 169, b: 245}, end: {r: 251, g: 121, b: 120} },
			Maghrib: { start: {r: 251, g: 121, b: 120}, end: {r: 1, g: 82, b: 180} },
			Isha: { start: {r: 1, g: 82, b: 180}, end: {r: 154, g: 94, b: 247} },
		}

		var makeColorPiece = function(num){
			num = Math.min(num, 255);   // not more than 255
			num = Math.max(num, 0);     // not less than 0
			var str = num.toString(16);
			if (str.length < 2) {
			    str = "0" + str;
			}
			return(str);
		}

		convertToHexString = function(colorRGB){
			return "#" + makeColorPiece(colorRGB.r) + makeColorPiece(colorRGB.g) + makeColorPiece(colorRGB.b);
		}

		var makeGradientColor = function(color1, color2, percent){
			var newColor = {};

			function makeChannel(a, b) {
	      return(a + Math.round((b-a)*(percent/100)));
	    }

	    newColor.r = makeChannel(color1.r, color2.r);
	    newColor.g = makeChannel(color1.g, color2.g);
	    newColor.b = makeChannel(color1.b, color2.b);

	    return newColor;
		}

		var setColor = function(){
			var percentageOfSectionPassed = ($scope.minutesSinceStart*100) / ($scope.minutesSinceStart + $scope.minutesTillNext)/2 + 50;
			$scope.topColor = convertToHexString(colors[$scope.currentPrayerName].start)
			$scope.bottomColor = convertToHexString(makeGradientColor(colors[$scope.currentPrayerName].start, colors[$scope.currentPrayerName].end, percentageOfSectionPassed));
		}

		var getLocation = function(){
			if(navigator.geolocation){
				// console.log("getLocation");
				navigator.geolocation.getCurrentPosition(function(position){
					$scope.latitude = position.coords.latitude;
					$scope.longitude = position.coords.longitude;

					$scope.$apply(getPrayerTimes($scope.currentDay, $scope.latitude, $scope.longitude, $scope.prayerOffset));
				},
				function(error){
					var locationName, locationLat, locationLong;
					locationName = getCookie("prayer_name");
					locationLat = getCookie("prayer_lat");
					locationLong = getCookie("prayer_long");

					if(locationName && locationLat && locationLong){
						$scope.myLocation = locationName;
						$scope.latitude = locationLat;
						$scope.longitude = locationLong;
						if($scope.myLocation){
							$scope.place = $scope.myLocation;
						}
						timeZone();
					}
					else{
						console.log("ERROR");
						console.log(error);
						$scope.showOptions = true;						
					}
				},
				{enableHighAccuracy:true, maximumAge:30000, timeout:27000});
			}
		}

		calculateNextPrayerIndex = function(time, prayerArray){
			var currentTimeAway = 24;
			var currentPrayerIndex = 5;

			var nextTimeAway = 24;
			var nextPrayerIndex = 0;

			for(var i=0; i<prayerArray.length; i++){
				
				var currentDifference = time -  prayerArray[i];
				var nextDifference = prayerArray[i] - time;

				if(currentDifference < currentTimeAway && currentDifference > 0){
					currentTimeAway = currentDifference;
					currentPrayerIndex = i;
				}
				if(nextDifference < nextTimeAway && nextDifference > 0){
					nextTimeAway = nextDifference;
					nextPrayerIndex = i;
				}
			}

			return nextPrayerIndex;
		}

		var minutesSinceBeginningOfCurrentPrayer = function(time, beginningTime){
			return Math.round((((time - beginningTime)+24)%24)*60);
		}

		var minutesTillNextPrayer = function(time, nextTime){
			return Math.round((((nextTime - time)+24)%24)*60);
		}

		var timeTillNextPrayerString = function(minutes){
			if(minutes < 60){
				return minutes + " minute"+(parseInt(minutes) == 1 ? "" : "s")+" till";
			}
			else{
				return "More than " + parseInt(minutes/60) + " hour"+(parseInt(minutes/60) == 1 ? "" : "s")+" till";
			}
		}

		var secondCounter = 0;
		var onUpdateTime = function(){
			var d = new Date();
			$scope.clock = d.getTime();
			var timeNow = new Date($scope.clock);
			var timeNowDecimal = timeNow.getHours() + timeNow.getMinutes()/60;
			
			if(!prayerTimesSet){ return; }

			getCurrentAndNextPrayer(timeNowDecimal);

			if(secondCounter >= 30){
				secondCounter = 0;
				setColor();
			}
			secondCounter++;
		}

		var setUpTime = function(){
			$scope.clock = Date.now();
			var second = 1000;
			var minute = 60*second;
			$interval(onUpdateTime, second)
		}


		var filterPrayerTimesForDisplay = function(prayerTimes){
			return [
				{ name: "Fajr", values: prayerTimes.fajr.split(":") },
				{ name: "Sunrise", values: prayerTimes.sunrise.split(":") },
				{ name: "Dhuhr", values: prayerTimes.dhuhr.split(":") },
				{ name: "Asr", values: prayerTimes.asr.split(":") },
				{ name: "Maghrib", values: prayerTimes.maghrib.split(":") },
				{ name: "Isha", values: prayerTimes.isha.split(":") },
			]
		}

		var filterPrayerTimesForCalculations = function(pTimes){
			return [
				Number(pTimes[0].values[0]) + Number(pTimes[0].values[1]) / 60,
				Number(pTimes[1].values[0]) + Number(pTimes[1].values[1]) / 60,
				Number(pTimes[2].values[0]) + Number(pTimes[2].values[1]) / 60,
				Number(pTimes[3].values[0]) + Number(pTimes[3].values[1]) / 60,
				Number(pTimes[4].values[0]) + Number(pTimes[4].values[1]) / 60,
				Number(pTimes[5].values[0]) + Number(pTimes[5].values[1]) / 60,
			]
		}

		$scope.convertTimeValueForDisplay = function(time){
			if(typeof time !== "object"){
				return;
			}
			var isAmOrPm = 0;
			var hours = time[0];
			var minutes = time[1];
			if(hours / 12 >= 1){
				isAmOrPm = 1;
				hours = hours % 12;
			}
			if(hours == 0){
				hours = 12;
			}
			hours = parseInt(hours);

			return hours + ":" + minutes + (isAmOrPm ? " PM" : " AM")
		}

		var formatHeadlineText = function(currentPrayerIndex, nextPrayerIndex, timeNowDecimal){
			$scope.currentPrayerName = $scope.prayerTimesDisplayArray[currentPrayerIndex].name
			$scope.currentPrayerTime = $scope.convertTimeValueForDisplay($scope.prayerTimesDisplayArray[currentPrayerIndex].values)

			if(currentPrayerIndex != 1){
				$scope.currentPrayerString = $scope.currentPrayerName;
				$scope.currentPrayerTimeString = "(" + $scope.currentPrayerTime + ")";
			}
			else{
				$scope.currentPrayerString = "NO FARD";
				$scope.currentPrayerTimeString = "";
			}

			$scope.minutesSinceStart = minutesSinceBeginningOfCurrentPrayer(timeNowDecimal, $scope.prayerTimesCalcArray[currentPrayerIndex]);
			$scope.minutesTillNext = minutesTillNextPrayer(timeNowDecimal, $scope.prayerTimesCalcArray[nextPrayerIndex]);

			$scope.nextPrayer = $scope.prayerTimesDisplayArray[nextPrayerIndex];
			$scope.timeTillNextPrayerString = timeTillNextPrayerString($scope.minutesTillNext);
		}

		var getCurrentAndNextPrayer = function(timeNowDecimal){
			var nextPrayerIndex = calculateNextPrayerIndex(timeNowDecimal, $scope.prayerTimesCalcArray);
			var currentPrayerIndex = 0;

			currentPrayerIndex = nextPrayerIndex - 1;
			if(currentPrayerIndex < 0) currentPrayerIndex = 5;
			if(nextPrayerIndex == 1) nextPrayerIndex = 2;

			formatHeadlineText(currentPrayerIndex, nextPrayerIndex, timeNowDecimal);
		}

		var setUpArrays = function(){
			$scope.prayerTimesDisplayArray = filterPrayerTimesForDisplay($scope.times);
			$scope.prayerTimesCalcArray = filterPrayerTimesForCalculations($scope.prayerTimesDisplayArray);
		}

		var getPrayerTimes = function(date, latitude, longitude, prayerOffset){

			$scope.times = prayTimes.getTimes(date, [latitude, longitude], prayerOffset);
			prayerTimesSet = true;

			setUpArrays();
			onUpdateTime();
			setColor();
		}

		var prayerTimesSet = false;
		$scope.isCurrentDay = true;
		$scope.isCurrentLocation = true;
		$scope.today = new Date();
		$scope.currentDay = new Date();
		var offset = $scope.currentDay.getTimezoneOffset();
		$scope.prayerOffset = offset / 60 * -1;
		$scope.initialPrayerOffset = $scope.prayerOffset;

		var init = function(){
			prayTimes.tune( {maghrib: 0.5} );
			prayTimes.setMethod("ISNA");
			dateAvailable();
			setUpTime();
			getLocation();

		}

		$scope.showOptionsView = function(){
			$scope.showOptions = !$scope.showOptions;
		}

		init();

	}])
