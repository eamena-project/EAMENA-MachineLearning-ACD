// To access the EAMENA MLACD JavaScript code copy the following URL (https://code.earthengine.google.com/2729b95df2867e0d2568a8d0e5cbfe22), or you can copy the full script below however, this means it will not inlcude the assets for the case study demonstration.

// This script is developed to distingusih the land cover changes in Bani Walid, Libya and detect threats and changes to archaeological sites.
// This EAMENA Machine Learning ACD script has been developed by EAMENA Research Associate Dr. Ahmed Mahmoud based on the Rayne et al. 2020 Remote Sensing paper
// (Detecting Change at Archaeological Sites in North Africa Using Open-Source Satellite Imagery) and
// @Ahmed M A Mahmoud PhD Script for Monitoring Sand Dunes using GEE 
//*****************************************************************************************************************************************************************//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//****************************************************   Section 1 - Defining Variables & Inputs ******************************************************************//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Description: Adding Feature Collections, in this stage all the feature classes have to be imported and called into the code editor in preparation for
// spatial and statistical analysis; image classification, time series analysis
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//******************************************************   Define the study area  *********************************************************************************//
// Study_Area = Study_Area.geometry();
Map.centerObject(Study_Area);
Map.addLayer(Study_Area, {color: 'blue'}, 'Study_Area', false);
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//********************************************  Define or import the Archaeological Sites  *************************************************************************//
// var Sites = ee.FeatureCollection("projects/ee-eamena-libya/assets/BeniUlid_Sites");
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//*************************************************   Define Training Samples & Classification Variables   **************************************************************************//
// Define the training samples dataset of your case study
var TS1 = BareSoil; var TS2 = Mountain; var TS3 = Quarry; var TS4 = Urban; var TS5 = Vegetation; // Add and define additional training samples (e.g., TS6 = Water, etc.) or remove any that are not relevant to your current case study
// Define variables for each land cover class to contain the names of the training datasets 
var C1 = 'BareSoil'; var C2 = 'Mountain'; var C3 = 'Quarry'; var C4 = 'Urban'; var C5 = 'Vegetation';
// Define all training sets in an array
var trainingSets = [TS1, TS2, TS3, TS4, TS5];
// Define a Class Array which contain the training dataset names 
var classArray = [C1,C2,C3,C4,C5];
// Define the colour palette for each class 
var classesPalette = ['#ffeec3','#170821', '#c7c6c5', '#cdc2a8', '#118b29'];
//******************************************************************************************************************************//
//***********************************   Section 2 - Adding Image collections and Feature collections ***************************//
//******************************************************************************************************************************//
// 2.1 Import Sentinel 2 Multi spectral instrument L2A images 
////////////////////////////////////////////////////////////////////////////////////////////////////////////
// cloud mask using Scene Classification Layer (SCL) bit values only the vegetation (4), Bare soils (5),
// Water (6) and unclassified (7) were ketp the rest were masked out // 
function s2ClearSky(image) {
      var scl = image.select('SCL');
      var clear_sky_pixels = scl.eq(4).or(scl.eq(5)).or(scl.eq(6)).or(scl.eq(7));
      return image.updateMask(clear_sky_pixels).divide(10000).copyProperties(image, ["system:time_start"])}
// Define a fucntion to add a NDVI band to the image collection for NDVI time series analysis 
function addNDVI(image){
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('ndvi')
  return image.addBands([ndvi])
}
// Define a fucntion to add a Moisture index band to the image collection for NDMI time series analysis 
function addNDMI(image){
  var ndmi = image.normalizedDifference(['B8A', 'B11']).rename('ndmi')
  return image.addBands([ndmi])
}
// Define a fucntion to add a Normalized Difference Water Index (NDWI) band to the image collection for NDMI time series analysis 
function addNDWI(image){
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('ndwi')
  return image.addBands([ndwi])
}
//******************************************************************************************************************************//
// Define Initial Inputs by the User to Initiate the processing 
// This snippet of the script allows the user to add their own dates of interest, and AOI geometry or point (P), which will be used to filter out the area for the image collection 
var startDate = ui.Textbox({
  placeholder: 'Start: YYYY-MM-DD',
  onChange: function(value) {
    startDate.setValue(value);
    return(value);
  }
});
var endDate = ui.Textbox({
  placeholder: 'End: YYYY-MM-DD',
  onChange: function(value) {
    endDate.setValue(value);
    return(value);
  }
});
// This function is developed to generate a buffer for each site location by allowing users to define the buffer value in meters
var featureBuffer = ui.Textbox({
  placeholder: 'Buffer in meters',
  onChange: function (value){
    featureBuffer.setValue(value);
    return value;
}});
// Create a run button to excuate the first stage of the ACD script
var RunButton = ui.Button({
    label: 'Run'
});
// Create a run button to excuate the second stage of the ACD script
var RunButton2 = ui.Button({
    label: 'Run'
});
/****************************************************************************************************************/
// Set and define the classes values 
// Create an empty array to store the index values for each class from classArray
var classValues = [];
// Loop through the input array and add the index values to the new list
for (var i = 0; i < classArray.length; i++) {
  classValues.push(i);
}
// Print the new list of index values
// print(classValues);
//*********** This snippet is to automate the change detection step and allow the user to choose which classification change results to analyze 
// Define the setup function outside the click handler but keep it ready to use
var changeSelector, analyzeButton, changeAnalysisLabel;
var changes = null;
var changesPerSite = null;
// ===== SETUP CHANGE ANALYSIS UI =====
function setupChangeAnalysisUI() {
  // Generate change combinations
  var changeLabels = [];
  for (var i = 0; i < classValues.length; i++) {
    for (var j = 0; j < classValues.length; j++) {
      changeLabels.push(classArray[i] + " to " + classArray[j]);
    }
  }
  // Create UI elements (only once)
  if (!changeSelector) {
    changeSelector = ui.Select({
      items: changeLabels,
      placeholder: 'Select Change Type'
    });
    analyzeButton = ui.Button({
      label: 'Analyse Selected Change',
      disabled: true
    });
    changeAnalysisLabel = ui.Label('6-Change Detection Analysis');
    changeAnalysisLabel.style().set('fontWeight', 'bold');
  }
}
//************************************************************************************************************//
RunButton.onClick(function(){
  var homogeneousBands = ['B1','B2','B3','B4','B5','B6','B7','B8','B8A','B9','B11','B12',
                     'AOT','WVP','SCL','TCI_R','TCI_G','TCI_B','QA10','QA20','QA60',
                     'MSK_CLASSI_OPAQUE','MSK_CLASSI_CIRRUS','MSK_CLASSI_SNOW_ICE',
                     'MSK_CLDPRB','MSK_SNWPRB'];
  var startDateValue = startDate.getValue();
  var endDateValue = endDate.getValue();
  var SenImageCollection = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                    .filterDate(startDateValue, endDateValue)
                    .filterBounds(Study_Area)
                    .filter(ee.Filter.lt('CLOUD_COVERAGE_ASSESSMENT',0.5))
                    .map(function(img){
                      return img.select(homogeneousBands);
                    });
print('SenImageCollection', SenImageCollection);   
// print('SenImageCollection', SenImageCollection); 
var listOfimages = SenImageCollection.toList(SenImageCollection.size());
// Map.addLayer(ee.Image(listOfimages.get(0)), {bands: ['B8','B3', 'B2'], min: 0, max: 3000}, '0');
// Get the list of the image acquisition dates
var Imagedates = SenImageCollection.map(function(image){
    return ee.Feature(null, {'date': image.date().format('YYYY-MM-dd'), 'id': image.id()});
})
.distinct('date')
.aggregate_array('date');
// print ('Imagedates', Imagedates);
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Create a mosaic of the images that have been aquired on the same day to have a single image that covers the whole study area
// Modified after https://gis.stackexchange.com/users/167933/jean
//https://gis.stackexchange.com/questions/369057/google-earth-engine-roi-area-falling-outside-partial-coverage-by-sentinel-1-tile
function makeMosaics(image) {
  var j = ee.Image(image);
  var date = ee.Date(j.get('system:time_start'));
  // add only hour to exclude images from other paths
  var filteredDataset = SenImageCollection.filterDate(date, date.advance(1,'hour'));
  // add all image properties to the new image
  var toReturn = ee.Image(filteredDataset.mosaic().copyProperties(image,image.propertyNames()));
  // add geometries
  var geometries = filteredDataset.map(function(i){
    return ee.Feature(i.geometry());
  });
  var mergedGeometries = geometries.union();
  return toReturn.set('system:footprint', mergedGeometries.geometry());
}
var mosaicedImages = SenImageCollection.map(makeMosaics);
// Select images where the entire study area falls within the footprint of the image
var filteredmosaicedCollection = mosaicedImages.filter(ee.Filter.contains('.geo', Study_Area));
// print('filteredmosaicedCollection size:', filteredmosaicedCollection.size());
var filteredmosaicedImages = filteredmosaicedCollection;
// print(filteredmosaicedImages, 'filteredmosaicedImages');
//Convert the filtered mosaiced Image collection to a list
var filteredmosaicedImagesList = filteredmosaicedImages.toList(filteredmosaicedImages.size());
// print (filteredmosaicedImagesList);
// Filter out images (i) with null bands in the image collection. remove images with no data
// This has been modified after https://gis.stackexchange.com/users/45066/xunilk, based on
// https://gis.stackexchange.com/questions/387737/filter-null-bands-from-image-collection-in-gee
var newList = filteredmosaicedImagesList.map(function comprobeBandsNumber(i){
var new_list = ee.List([]); 
var count = ee.Image(i).bandNames().size();
var comp = ee.Algorithms.If(count.eq(26), i, 0);
  new_list = new_list.add(comp);
  return new_list;
}).flatten();
//removing zeroes in new list
newList = newList.removeAll([0]);
// print("new list", newList);
// //convert from list to image collection and Add NDVI, NDMI & NDWI bands to the Image Collection
var mosaicedImageCollection = ee.ImageCollection(newList).map(s2ClearSky)
.map(addNDVI).map(addNDMI).map(addNDWI).map(function(image){return image.clip(Study_Area)});
// print (mosaicedImageCollection, "maskedmosaicedImageCollection");
// Get the date for the monthly images 
var ImageDates = mosaicedImageCollection.map(function(image){
    return ee.Feature(null, {'date': image.date().format('YYYY-MM-dd'), 'id': image.id()});
})
.distinct('date')
.aggregate_array('date');
print ('Image Dates', ImageDates);
// // Add NDVI, NDMI & NDWI bands to the Image Collection
var s2FilteredCollection = mosaicedImageCollection.map(addNDVI).map(addNDMI).map(addNDWI);
print("Sentinel-2 Filtered Image Collection", s2FilteredCollection);
//************************************************************************************************************************//
// This function is developed to generate a buffer for each site location based on the value imported by the user
var featureBufferValue = parseFloat(featureBuffer.getValue()); // parseFloat parses a value number defined by the user on the user interface
function buffer(feature){
var feature_buffer = feature.buffer(featureBufferValue);
return feature_buffer;
}
var Sites_buffer = Sites.map(buffer);
// print(Sites, 'Sites');
// Create an empty image into which to paint the features, cast to byte.
var empty = ee.Image().byte();
// Paint all the polygon edges with the same number and width, display.
var Sites_buffer_polygons = empty.paint({
  featureCollection: Sites_buffer,
  color: 1,
  width: 3
});
Map.addLayer(Sites_buffer_polygons, {palette: 'FF0000'}, 'Sites_buffer',false);
Map.addLayer(Sites, {color: 'blue'}, 'Sites',false);
//************************************************************************************************************************//
// Merge the training samples into one feature collection
var sampleDatasetFC = ee.FeatureCollection(trainingSets).flatten();
// print('sampleDatasetFC', sampleDatasetFC);
// Convert the training samples feature collection into an image 
var sampleDatasetFCImage = ee.Image().byte().paint(sampleDatasetFC, 'landcover').rename('landcover');
// Collect 100 training samples for each class using the stratified sample function 
var StratifiedSampleDataset = sampleDatasetFCImage.stratifiedSample({
  numPoints: 1000,
  classBand: 'landcover',
  region: Study_Area,
  scale: 10,
  classValues: [0,1,2,3,4,5,6,7,8,9],
  classPoints: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
  dropNulls: true,
  geometries: true
});
// print (StratifiedSampleDataset, 'StratifiedSampleDataset');
Map.addLayer(StratifiedSampleDataset, {}, 'StratifiedSampleDataset',false);
// Training/Validation Split 
var StratifiedSampleDatasetRandom = StratifiedSampleDataset.randomColumn();
var training_samples = StratifiedSampleDatasetRandom.filter(ee.Filter.lt('random', 0.7));
var validation_samples = StratifiedSampleDatasetRandom.filter(ee.Filter.gte('random', 0.7));
Map.addLayer(training_samples, {color: 'red'}, 'training_samples', false);
Map.addLayer(validation_samples, {color: 'blue'}, 'validation_samples', false);
//*********************************************************************************************************//
// Export Feature Collections
//*********************************************************************************************************//
//Export the study area shapefile
//If you want to export the dataset for each training samples you can change the name of collection instead of BareSoil change it to the new feature collection and then uncomment the lines between 259-264 
Export.table.toDrive({
  collection: ee.FeatureCollection(Study_Area),
  description: 'Study_Area',
  fileFormat: 'SHP'
});
//Export the BaniWalid_Sites shapefile
Export.table.toDrive({
  collection: ee.FeatureCollection(Sites),
  description: 'Sites',
  fileFormat: 'shp'
});
//Export the training samples shapefile
Export.table.toDrive({
  collection: ee.FeatureCollection(training_samples),
  description: 'Training_Samples',
  fileFormat: 'shp'
});
//Export the stratified test samples shapefile
Export.table.toDrive({
  collection: ee.FeatureCollection(validation_samples),
  description: 'validation_samples',
  fileFormat: 'shp'
});
// //Export the bareSoil training dataset shapefile
// Export.table.toDrive({
//   collection: ee.FeatureCollection(BareSoil),
//   description: 'BareSoilDataset',
//   fileFormat: 'shp'
// });
// //Export the mountain training dataset shapefile
// Export.table.toDrive({
//   collection: ee.FeatureCollection(Mountain),
//   description: 'MountainDataset',
//   fileFormat: 'shp'
// });
// // Export the quarry training dataset shapefile
// Export.table.toDrive({
//   collection: ee.FeatureCollection(Quarry),
//   description: 'QuarryDataset',
//   fileFormat: 'shp'
// });
// //Export the urban training dataset shapefile
// Export.table.toDrive({
//   collection: ee.FeatureCollection(Urban),
//   description: 'UrbanDataset',
//   fileFormat: 'shp'
// });
// // Export the vegetation training dataset shapefile
// Export.table.toDrive({
//   collection: ee.FeatureCollection(Vegetation),
//   description: 'VegetationDataset',
//   fileFormat: 'shp'
// });
//************************************************************************************************************************//
//************************************************************************************************************************//
// All the variables used in the select widget must be declared first using "var" to be considered as variables
// Create a drop down menu for the image dates so that the user can select the prior image ID to compare with the post image
var first_ImageDate, first_ImageDateID, second_ImageDate, second_ImageDateID;
var first_ImageIDValue = ui.Select({
  items: ImageDates.getInfo(),
  placeholder: 'Select First Image',
  onChange: function selectedfirst_ImageDate() {
  first_ImageDate = first_ImageIDValue.getValue();
  first_ImageDateID = ImageDates.indexOf(first_ImageDate);
  // print(first_ImageDate);
  // print(first_ImageDateID);
  },
  style: {width: '200px'}
});
// print (first_ImageIDValue);
Map.add(first_ImageIDValue);
// Create a drop down menu for the image dates so that the user can select the post image ID to compare with the prior image
var second_ImageIDValue = ui.Select({
  items: ImageDates.getInfo(),
  placeholder: 'Select Second Image',
  onChange: function selectedsecond_ImageDate() {
  second_ImageDate = second_ImageIDValue.getValue();
  second_ImageDateID = ImageDates.indexOf(second_ImageDate);
  // print(second_ImageDate);
  // print(second_ImageDateID);
  },
  style: {width: '200px'}
});
// print (second_ImageIDValue);
Map.add(second_ImageIDValue);
//******************************************************************************************//
RunButton2.onClick(function(){
//**********************************************************************************************************************//
//*************************************** Section 3 - Image Collection Visualization ***********************************//
//**********************************************************************************************************************//
// Visualzation of a single image//
var listOfimages = s2FilteredCollection.toList(s2FilteredCollection.size());
// print(listOfimages, 'listOfimages');
// This snippt is developed to select the two images using the images dates identifed by the user
var first_Image = ee.Image(listOfimages.get(first_ImageDateID));
var second_Image = ee.Image(listOfimages.get(second_ImageDateID));
// print(first_Image);
// print(second_Image);
Map.addLayer(first_Image, {bands: ['B8','B3', 'B2'], min: 0, max: 0.3}, 'First_Image',false);
Map.addLayer(second_Image, {bands: ['B8', 'B3', 'B2'], min: 0, max: 0.3},'Second_Image',false);
// // Create RGB visualization images to use as animation frames.
// // Define GIF visualization parameters.
var gifParams = {
  'region': Study_Area,
  'dimensions': 600,
  'crs': SenImageCollection.select('B1').first().projection(),
  'framesPerSecond': 1,
  // 'min':0,
  // 'max':30,
  'maxPixels': 1e200
};
var text = require('users/gena/packages:text'); // Import gena's package which allows text overlay on image

var annotations = [
  {position: 'left', offset: '1%', margin: '1%', property: 'label', scale: 200} //large scale because image if of the whole world. Use smaller scale otherwise
  ]
  
function addText(image){
  
  var timeStamp = ee.Date(image.get('system:time_start')).format().slice(0,10); // get the time stamp of each frame. This can be any string. Date, Years, Hours, etc.
  var timeStamp = ee.String('Date: ').cat(ee.String(timeStamp)); //convert time stamp to string 
  var image = image.visualize({bands: ['B8', 'B3', 'B2'], min: 0, max: 6.5}).set({'label':timeStamp}); // set a property called label for each image
  
  var annotated = text.annotateImage(image, {}, Study_Area, annotations); // create a new image with the label overlayed using gena's package

  return annotated 
}

var ImageCollectionGif = s2FilteredCollection.map(addText) //add time stamp to all images
// print(ImageCollectionGif.getVideoThumbURL(gifParams)); //print gif
// var filmArgs = {
//   dimensions: 128,
//   region: Study_Area,
//   crs: 'EPSG:3263'
//   };
// Print a URL that will produce a filmstrip when accessed.
// print(ImageCollectionGif.getFilmstripThumbURL(filmArgs));
//*************************************************************************************************************//
//**************************** Section 4 - Image Differencing, and Indices NDVI, NDMI, NDWI  ******************//
//*************************************************************************************************************//
// Calculate Image Differencing between two dates
var prior_image = first_Image.select(['B1','B2', 'B3', 'B4','B5','B6','B7','B8', 'B8A','B9','B11','B12']);
var post_image = second_Image.select(['B1','B2', 'B3', 'B4','B5','B6','B7','B8', 'B8A','B9','B11','B12']);
var imageDiff = post_image.select(['B8']).subtract(prior_image.select(['B8']));
// print('imageDiff', imageDiff);
Map.addLayer(imageDiff, {min: -1, max: 1, palette:['red', 'yellow', 'green']}, 'Image_Difference',false);
//********************************************************************************************************//
// Calculate Normalized Difference Indices (NDVI), (NDMI), (NDWI)
var prior_imageNDVI = ((prior_image.select('B8')).subtract(prior_image.select('B4'))).divide((prior_image.select('B8')).add(prior_image.select('B4')));
var post_imageNDVI = ((post_image.select('B8')).subtract(post_image.select('B4'))).divide((post_image.select('B8')).add(post_image.select('B4')));
var NDVI_Palette = ['red', 'yellow', 'green'];
Map.addLayer(prior_imageNDVI, {min: -1, max: 1, palette: NDVI_Palette}, 'First_imageNDVI',false);
Map.addLayer(post_imageNDVI, {min: -1, max: 1, palette: NDVI_Palette}, 'Second_imageNDVI',false);
// Plot NDVI Time series chart for a location of interset 
var NDVIchart = ui.Chart.image.series({
  imageCollection: s2FilteredCollection.select('ndvi'),
  region: P,
  reducer: ee.Reducer.mode(),
  scale:10,
  }).setOptions({
    interpolateNulls: true,
    trendlines: {0: {color: 'CC0000'}},
    lineWidth: 3,
    pointSize: 7,
    series: {0: {titleTextStyle: {fontSize:30, italic: false, bold: true}}, textStyle: {fontSize: 30, bold: true}},
    title: ' NDVI Time Series at Location (P)', titleTextStyle: {fontSize:35, italic: false, bold: true}, textStyle: {fontSize: 30, bold: true},
    vAxis: {title: 'NDVI', titleTextStyle: {fontSize:30, italic: false, bold: true}, textStyle: {fontSize: 30, bold: true}},
    hAxis: {title: 'Date', format: 'YYYY-MMM', titleTextStyle: {fontSize:30, italic: false, bold: true}, gridlines: {count:20, color: 'black'}, textStyle: {fontSize: 30, bold: true}},
    legend: {textStyle: {fontSize: 30, italic: false, bold: true}}
  });
var NDVIbutton = ui.Button('Press to get the NDVI Time Series Chart at Location (P)');
NDVIbutton.onClick(function(){
  print(NDVIchart);
});
print(NDVIbutton);
// Plot NDMI Time series chart for a location of interset 
var NDMIchart = ui.Chart.image.series({
  imageCollection: s2FilteredCollection.select('ndmi'),
  region: P,
  reducer: ee.Reducer.mode(),
  scale:10,
  }).setOptions({
    interpolateNulls: true,
    trendlines: {0: {color: 'CC0000'}},
    lineWidth: 3,
    pointSize: 7,
    series: {0: {titleTextStyle: {fontSize:30, italic: false, bold: true}}, textStyle: {fontSize: 30, bold: true}},
    title: ' NDMI Time Series at Location (P)', titleTextStyle: {fontSize:35, italic: false, bold: true}, textStyle: {fontSize: 30, bold: true},
    vAxis: {title: 'NDMI', titleTextStyle: {fontSize:30, italic: false, bold: true}, textStyle: {fontSize: 30, bold: true}},
    hAxis: {title: 'Date', format: 'YYYY-MMM', titleTextStyle: {fontSize:30, italic: false, bold: true}, gridlines: {count:20, color: 'black'}, textStyle: {fontSize: 30, bold: true}},
    legend: {textStyle: {fontSize: 30, italic: false, bold: true}}  
  });
var NDMIbutton = ui.Button('Press to get the NDMI Time Series Chart at Location (P)');
NDMIbutton.onClick(function(){
  print(NDMIchart);
});
// print(NDMIbutton);
// Plot NDWI Time series chart for a location of interset 
var NDWIchart = ui.Chart.image.series({
  imageCollection: s2FilteredCollection.select('ndwi'),
  region: P,
  reducer: ee.Reducer.mode(),
  scale:10,
  }).setOptions({
    interpolateNulls: true,
    trendlines: {0: {color: 'CC0000'}},
    lineWidth: 3,
    pointSize: 7,
    series: {0: {titleTextStyle: {fontSize:30, italic: false, bold: true}}, textStyle: {fontSize: 30, bold: true}},
    title: ' NDWI Time Series at Location (P)', titleTextStyle: {fontSize:35, italic: false, bold: true}, textStyle: {fontSize: 30, bold: true},
    vAxis: {title: 'NDWI', titleTextStyle: {fontSize:30, italic: false, bold: true}, textStyle: {fontSize: 30, bold: true}},
    hAxis: {title: 'Date', format: 'YYYY-MMM', titleTextStyle: {fontSize:30, italic: false, bold: true}, gridlines: {count:20, color: 'black'}, textStyle: {fontSize: 30, bold: true}},
    legend: {textStyle: {fontSize: 30, italic: false, bold: true}}
  });
var NDWIbutton = ui.Button('Press to get the NDWI Time Series Chart at Location (P)');
NDWIbutton.onClick(function(){
  print(NDWIchart);
});
// print(NDWIbutton);
//*******************************************************************************************************************************//
//************ Section 5 - Image Classification - Supervised Classification using Machine Learning Models (i.e. Random Forest)***//
//*******************************************************************************************************************************//
// // Define the spectral samples polygons  to understand the responses of each of the classes to different image bands moreover, 
// // to understand how different land cover types interact with the enrgey coming from the sun and how features reflect and absorb light
// var spectralSamples = ee.FeatureCollection(
//   trainingSets.map(function(ts, i) {
//     return ts.first().set('class', classArray[i]);
//   })
// );
// Map.addLayer(spectralSamples, {palette: classesPalette},'spectralSamples', false);
// print(spectralSamples, 'spectralSamples');
// Set the colors for the class series to plot the line charts 
// for each series and class with the color identified in the classes palette
var classseries = {};
for (var i = 0; i < classArray.length; i++) {
  classseries[i] = {
    color: classesPalette[i],  
    label: classArray[i]       
  };
}
// // Convert spectralSamples to a list of features with a 'class' property
// var labeledSamples = spectralSamples.map(function(feat, i) {
//   return feat.set('class', classArray[i]);
// });
// var classificationSpectralChart = ui.Chart.image.regions({  image: prior_image,
//   regions: spectralSamples,
//   reducer: ee.Reducer.mean(),
//   scale: 10,
//   seriesProperty: 'class'  // <-- Tells the chart to group by class name
// })
//   .setOptions({
//     title: 'Surface Spectral Reflectance', titleTextStyle: {fontSize:35, italic: false, bold: true},
//     vAxis: {title: 'Reflectance', titleTextStyle: {fontSize:30, italic: false, bold: true}, textStyle: {fontSize: 20, bold: true}},
//     hAxis: {title: 'Image Band', titleTextStyle: {fontSize:30, italic: false, bold: true}, gridlines: {count:20, color: 'black'}, textStyle: {fontSize: 20, bold: true}},
//     interpolateNulls: true,
//     lineWidth: 5,
//     pointSize: 15,
//     series: classseries,
//     // seriesNames: classArray,  // <-- THIS forces legend labels
// });
// var classificationSpectralChartButton = ui.Button('Press to get the Classification Spectral Reflectance Chart for the Identified Classification Features');
//   classificationSpectralChartButton.onClick(function(){
//   print(classificationSpectralChart);
// });
// print (classificationSpectralChartButton);
// Set visualization parameters to display the different classes in the classified image min = 0, max = class value of the last class
var class_vis = {min:classValues[0], max: classValues[classValues.length -1], palette: classesPalette}; 
//***********************************************************************************************************************************************//
//************       Train the Random Forest classifier using the training samples to classify the image collection            *****************//
// Define the spectral and index bands to use for classification
var selectedBands = ['B1','B2','B3','B4','B5','B6','B7','B8','B8A','B9','B11','B12','ndvi','ndwi'];
// Add a 'month' band to each image for seasonal context
var s2WithMonthBand = s2FilteredCollection.map(function(image) {
  var month = ee.Date(image.get('system:time_start')).get('month').int();
  return image
    .select(selectedBands)
    .addBands(ee.Image.constant(month).rename('month').toInt())
    .set('month', month)
    .copyProperties(image, ['system:time_start']);
});
// Final list of bands used for classification (spectral + month)
var finalBands = selectedBands.concat(['month']);
// Generate training samples by sampling each image and flattening all into one FeatureCollection
var monthlyTrainingSamples = s2WithMonthBand.map(function(image) {
  return image.sampleRegions({
    collection: training_samples,
    properties: ['landcover'],
    scale: 10,
    tileScale: 16
  });
}).flatten();  // Combine all per-image samples
// // Export the training dataset csv
// Export.table.toDrive({
//   collection: monthlyTrainingSamples,
//   description: 'monthlyTrainingSamples',
//   fileFormat: 'csv'
// });
// Train the Random Forest classifier using the combined training samples
var trainedClassifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 100,
  variablesPerSplit: null,
  minLeafPopulation: 5,
  bagFraction: 0.6,
  maxNodes: null,
  seed: 0
}).train({
  features: monthlyTrainingSamples,
  classProperty: 'landcover',
  inputProperties: finalBands
});
// print(trainedClassifier,'trainedClassifier');
// print('Feature importance:', trainedClassifier.explain().get('importance'));
// Function to classify new Sentinel-2 images using the trained classifier
function classifyImageWithRF(image) {
  var month = ee.Date(image.get('system:time_start')).get('month').int();
  var imageWithMonth = image
    .select(selectedBands)
    .addBands(ee.Image.constant(month).rename('month').toInt());
  return imageWithMonth
    .classify(trainedClassifier)
    .copyProperties(image, ['system:time_start']);
}
// Apply classifier to all images in the filtered Sentinel-2 collection
var RFclassified_imageCollection = s2WithMonthBand.map(classifyImageWithRF);
var RFclassified_imageCollectionlist = RFclassified_imageCollection.toList(RFclassified_imageCollection.size());
// print(RFclassified_imageCollectionlist, 'RFclassified_imageCollectionlist');
// Visualize classified Images // 
var prior_classifiedImage = ee.Image(RFclassified_imageCollectionlist.get(first_ImageDateID));
var post_classifiedImage = ee.Image(RFclassified_imageCollectionlist.get(second_ImageDateID));
Map.addLayer(prior_classifiedImage, class_vis, 'First_classifiedImage',false);
Map.addLayer(post_classifiedImage, class_vis, 'Second_classifiedImage',false);
//*********************************************************************************************************//
// Export Classification Maps
//*********************************************************************************************************//
Export.image.toDrive({
  image: ee.Image(RFclassified_imageCollectionlist.get(first_ImageDateID)),
  description: 'First_classifiedImage',
  folder: 'GEE_Exports',
  region: Study_Area,
  scale: 10,
  maxPixels: 1e12
});
Export.image.toDrive({
  image: ee.Image(RFclassified_imageCollectionlist.get(second_ImageDateID)),
  description: 'Second_classifiedImage',
  folder: 'GEE_Exports',
  region: Study_Area,
  scale: 10,
  maxPixels: 1e12
});
//******************************************************************************************************//
// Defining visualization and generating a legend
//******************************************************************************************************//
// Add a legend
var legendPanel = ui.Panel({
  style:{
    Position: 'bottom-right',
    padding: '5px'
  }
});
var legendtitle = ui.Label({
  value: 'Classification',
  style: {
    fontSize: '14px',
    fontWeight: 'bold',
    margin: '0px'
  }
});
legendPanel.add(legendtitle);
var color = classesPalette;
var lc_class = classArray;
var list_legend = function(color, description){
  var c = ui.Label({
    style:{
      backgroundColor: color,
      padding: '12px',
      fontWeight: 'bold',
      margin: '4px'
    }
  });
  var ds = ui.Label({
    value: description,
    style:{
      margin: '4px'
    }
  });
  return ui.Panel({
    widgets:[c, ds],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
}; 
var aMax = classValues.length;
// print(aMax)
for(var a = 0; a < aMax ; a++){
  legendPanel.add(list_legend(color[a], lc_class[a]));
}
Map.add(legendPanel);
//************************************************************************************************************//
//************************** Section 6 - Validation of Classification Results ********************************//
// Validation for the prior classified image
var PriorRFvalidation_test_samples = prior_classifiedImage.sampleRegions({collection: validation_samples,  properties: ['landcover'],  scale: 10});
// print('Prior RF valdiation dataset', PriorRFvalidation_test_samples);
var PriorRFtestaccuracy = PriorRFvalidation_test_samples.errorMatrix('landcover','classification');
print('First Classified Image Validation Overall Accuracy:', PriorRFtestaccuracy.accuracy());
var PriorProducerAccuracy = PriorRFtestaccuracy.producersAccuracy();
print('First Classified Image Producer Accuracy:',PriorProducerAccuracy);
var PriorConsumerAccuracy = PriorRFtestaccuracy.consumersAccuracy();
// var PriorConsumerAccuracy = ee.Array(PriorConsumerAccuracy.values());
print('First Classified Image Consumer Accuracy:', PriorConsumerAccuracy);
// // Calculate precision, recall, and F-score
var FirstClassifiedImagefScore = PriorRFtestaccuracy.fscore();
// Print the results
print('First Classified Image Confusion Matrix:', PriorRFtestaccuracy);
print('First Classified Image F-Score:', FirstClassifiedImagefScore);
// Validation for the post classified image
var PostRFvalidation_test_samples = post_classifiedImage.sampleRegions({collection: validation_samples,  properties: ['landcover'],  scale: 10});
var PostRFtestaccuracy = PostRFvalidation_test_samples.errorMatrix('landcover','classification');
print('Second Classified Image Validation Overall Accuracy:', PostRFtestaccuracy.accuracy());
var PostProducerAccuracy = PostRFtestaccuracy.producersAccuracy();
print('Second Classified Image Producer Accuracy:',PostProducerAccuracy);
var PostConsumerAccuracy = PostRFtestaccuracy.consumersAccuracy();
// var PostConsumerAccuracy = ee.Array(PostConsumerAccuracy.values());
print('Second Classified Image Consumer Accuracy:', PostConsumerAccuracy);
// // Calculate precision, recall, and F-score
var SecondClassifiedImagefScore = PostRFtestaccuracy.fscore();
// Print the results
print('Second Classified Image Confusion Matrix:', PostRFtestaccuracy);
print('Second Classified Image F-Score:', SecondClassifiedImagefScore);
// //***************************************************************************************//
// // Function to compute overall accuracy for a single classified image
// function computeOverallAccuracy(classifiedImage) {
//   var validation_test_samples = classifiedImage.sampleRegions({
//     collection: validation_samples,
//     properties: ['landcover'],
//     scale: 10
//   });
//   var testAccuracy = validation_test_samples.errorMatrix('landcover', 'classification');
//   return testAccuracy.accuracy();
// }
// // Map over the classified image collection to compute overall accuracies
// var accuracyList = RFclassified_imageCollection.map(function(image) {
//   var accuracy = computeOverallAccuracy(image);
//   return image.set('overall_accuracy', accuracy);
// });
// // Extract the overall accuracies and corresponding dates
// var accuracyValues = accuracyList.aggregate_array('overall_accuracy');
// var dates = accuracyList.aggregate_array('system:time_start');
// // Create a chart to plot the overall accuracies over time
// var OverallAccuracychart = ui.Chart.array.values({
//   array: accuracyValues,
//   axis: 0,
//   xLabels: dates
// }).setOptions({
//   title: 'Overall Accuracy Over Time',
//   hAxis: {title: 'Date'},
//   vAxis: {title: 'Overall Accuracy'},
//   legend: {position: 'none'},
//   lineWidth: 1,
//   pointSize: 3
// });
// // Print the chart
// print(OverallAccuracychart);
// //********************************************************
//*******************************************************************************************************************************//
//******************************** Section 7 - Detect the Changes between  Classified Images***************************************//
//*******************************************************************************************************************************//
// Calculate the area for each land cover class from all classification images
// Plot a chart to show the time series for area changes in each class
// This snippet of the script (how-to-automate-calculating-area) has been modified after (Daniel Wiell, 2020)
// https://gis.stackexchange.com/users/154371/daniel-wiell?tab=profile
// https://code.earthengine.google.com/d20512d31f5d46d5d9302000ce86bc28
// https://gis.stackexchange.com/questions/361464/google-earth-engine-how-to-automate-calculating-area-for-each-class-for-each-im/361486#361486
function areaByClass(image) {  
  var classNames = ee.List(classArray);
  var groups = ee.Image.pixelArea().addBands(image)
    .reduceRegion({ 
      reducer: ee.Reducer.sum().group({ 
        groupField: 1, groupName: 'class'}), 
      geometry: Study_Area, 
      scale: 100,
      bestEffort: true}).get('groups');
  var areaByClass = ee.Dictionary(
    ee.List(groups).map(function (AreaDic) {
    var AreaDic = ee.Dictionary(AreaDic)
      return [
        classNames.get(AreaDic.getNumber('class')),
        AreaDic.getNumber('sum').divide(1e6) // square km 
      ];
      }).flatten());
    return ee.Feature(null, areaByClass).copyProperties(image, ["system:time_start"]);
}

var RFClassareas = RFclassified_imageCollectionlist.map(areaByClass);

var AreaClassChart = ui.Chart.feature.byFeature({
  features: RFClassareas,
  xProperty: 'system:time_start',
  // Explicitly set the series (yProperties) in your desired order
  yProperties: classArray
})
.setChartType('LineChart')
.setOptions({
  interpolateNulls: true,
  lineWidth: 5,
  pointSize: 15,
  title: 'Land Cover Classification Areal Time Series',
  titleTextStyle: {fontSize:35, italic: false, bold: true},
  hAxis: {
    title: 'Date', 
    format: 'YYYY-MMM', 
    titleTextStyle: {italic: false, bold: true, fontSize:30}, 
    gridlines: {count:20, color: 'black'},
    textStyle: {fontSize: 30, bold: true}
  },
  vAxis: {
    title: 'Area of Classification (sq km)', 
    titleTextStyle: {italic: false, bold: true, fontSize:30},
    textStyle: {fontSize: 30, bold: true}
  },
  colors: color,
  legend: {textStyle: {fontSize: 30, bold: true}}
    });
// Export.table.toDrive({
//   collection: RFClassareas,
//   description: 'RFClassareas',
//   fileFormat: 'CSV'
// });
// print(AreaClassbutton);
// print(AreaClassChart);
var AreaClasschartbutton = ui.Button('Press to get the Land Cover Classification Areal Time Series');
AreaClasschartbutton.onClick(function(){
  print(AreaClassChart);
});
print(AreaClasschartbutton);
// Classification Differencing //neq divide pixels in the image with change (1) and no change (0)
var Img_classification_diff = prior_classifiedImage.subtract(post_classifiedImage).neq(0);
// print(Img_classification_diff,'Img_classification_diff');
Map.addLayer(Img_classification_diff, {min:0, max: 1, palette:['black', 'red']}, 'Binary Change',false);
// Create RGB visualization classification images to use as animation frames
// Define the Classification GIF visualization parameters.
var ClassificationGifParams = {
  'region': Study_Area,
  'dimensions': 600,
  'crs': SenImageCollection.select('B1').first().projection(),
  'framesPerSecond': 1,
  'maxPixels': 1e200
};
var text = require('users/gena/packages:text'); // Import gena's package which allows text overlay on image
var annotations = [
  {position: 'left', offset: '1%', margin: '1%', property: 'label', scale: 100} //large scale because image if of the whole world. Use smaller scale otherwise
  ]
function addText(RFclassified_image){
  var timeStamp = ee.Date(RFclassified_image.get('system:time_start')).format().slice(0,10); // get the time stamp of each frame. This can be any string. Date, Years, Hours, etc.
  var stringtimeStamp = ee.String('Date: ').cat(ee.String(timeStamp)); //convert time stamp to string 
  var RFclassified_image = RFclassified_image.visualize(class_vis).set({'label':stringtimeStamp}); // set a property called label for each image
  var annotated = text.annotateImage(RFclassified_image, {}, Study_Area, annotations); // create a new RFclassified_image with the label overlayed using gena's package
  return annotated; 
}
var classificationGif = RFclassified_imageCollection.map(addText); //add time stamp to all images
// Print the GIF URL to the console.
// print(classificationGif.getVideoThumbURL(ClassificationGifParams)); //print gif
// // Print a URL that will produce a filmstrip when accessed.
// print(classificationGif.getFilmstripThumbURL(filmArgs));
// // Define arguments for the getFilmstripThumbURL function parameters.
// var filmArgs = {
//   dimensions: 128,
//   region: Study_Area,
//   crs: 'EPSG:32630',
//   'maxPixels': 1e12
//   };
// // Print a URL that will produce the filmstrip when accessed.
// print(classificationGif.getFilmstripThumbURL(filmArgs));
// Add ACD-EAMENA in the GIF maps created so that if any one use it will have to autmaotically accredit the EAMENA work
//********************************************************************************************************************//
//********************************  Section 8 -  Change detection classification analysis  ***************************//
//********************************************************************************************************************// 
// Define the series names and values that will be used to plot the change detection time series charts
// Create an empty array to store the series names and values
var timeSeriesTicks = [];
// Create a for loop to generate the timeSeriesTicks array from the classArray
for (var i = 0; i < classArray.length; i++){
  var tick = {
  v:i, // v is the class value
  f:classArray[i] // f is the property class name
  };
  timeSeriesTicks.push(tick);
}
print("List of Class Names and Values:", timeSeriesTicks);
// Extract classification values to site location in order to detect the changes in land cover classes over time
// Plot classification Time series chart for a feature of interset 
var ClassificationTimeSerieschart = ui.Chart.image.series({
  imageCollection: RFclassified_imageCollection,
  region: P,
  reducer: ee.Reducer.mode(),
  xProperty:'system:time_start',
  scale:10
  }).setSeriesNames(['class'])
  .setOptions({
    interpolateNulls: true,
    lineWidth: 5,
    pointSize: 15,
    title: ' Classification Time Series at Location (P)', titleTextStyle: {fontSize:35, italic: false, bold: true},
    hAxis: {title: 'Date', format: 'YYYY-MMM', titleTextStyle: {fontSize:30, italic: false, bold: true}, gridlines: {count:20, color: 'black'}, textStyle: {fontSize: 30, bold: true}},
    vAxis: {title: 'Class', titleTextStyle: {fontSize:30, italic: false, bold: true}, 
    textStyle: {fontSize: 30, bold: true},viewWindow:{min:0, max:5},
    ticks: timeSeriesTicks},
    // ticks values can be adjusted to the classes values which can change from a study area to another, v&f are function used to define the class value and class type, v defines the class value and t defines the class type
    legend: {textStyle: {fontSize: 30, bold: true}}, 
    });
// print(ClassificationTimeSerieschart);
// Display the classification time series chart for a feature of interset 
var ClassificationTimeSerieschartButton = ui.Button('Press to get the Classification Time Series Chart for the Feature of Interest');
  ClassificationTimeSerieschartButton.onClick(function(){
  print(ClassificationTimeSerieschart);
});
print(ClassificationTimeSerieschartButton);
// This code snippet for detecting the changes between two classification images has been modified after a script written by Daniel Wiell
// https://gis.stackexchange.com/questions/359099/how-to-perform-change-detection-using-classified-land-cover-map-in-google-earth
//********************************************************************************************************************//
changes = ee.ImageCollection(ee.List(
  classValues.map(function (from, i) {
    return classValues.map(function (to,  j) {
      var changeValue = classValues.length * i + j + 1;
      return prior_classifiedImage.eq(from)
      .and(post_classifiedImage.eq(to))
      .multiply(changeValue)
      .int();
    });
  })
).flatten()).reduce(ee.Reducer.sum());
//*******************************************************************************************************************//
var numClasses = classValues.length;
var numChanges = numClasses * numClasses;  // All possible from->to combinations
var classificationchangepalette = [
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FF8000', '#FF0080', '#8000FF', '#00FF80', '#80FF00', '#0080FF',
  '#FF80FF', '#80FFFF', '#FFFF80', '#800000', '#008000', '#000080',
  '#808000', '#800080', '#008080', '#8B4513', '#D2691E', '#A0522D',
  '#CD853F', '#F4A460', '#DEB887', '#FFA07A', '#FFB6C1', '#FFD700',
  '#EEE8AA', '#98FB98', '#AFEEEE', '#DDA0DD', '#FFA500', '#FF4500',
  '#DA70D6', '#9932CC', '#9400D3', '#8A2BE2', '#4B0082', '#483D8B',
  '#6A5ACD', '#7B68EE', '#9370DB', '#2E8B57', '#3CB371', '#20B2AA',
  '#00FA9A', '#00FF7F', '#7CFC00', '#7FFF00', '#1E90FF', '#4169E1',
  '#0000CD', '#00008B', '#191970', '#DC143C', '#FF1493', '#FF69B4',
  '#DB7093', '#C71585'
].slice(0, numChanges);
Map.addLayer(ee.Image(changes), {min:1, max: numChanges, palette:classificationchangepalette},'Classification Changes',false);
// print(changes, 'ClassificationChanges');
//*********************************************************************************************************//
// Export classification change rasters for areas under specified threat
//*********************************************************************************************************//
Export.image.toDrive({
  image: changes.int(),
  description: 'classification_changes',
  folder: 'GEE_Exports',
  region: Study_Area,
  scale: 10,
  maxPixels: 1e12
});
//******************** Create a legend for classification change map*********************************************//
// Create change detection legend panel
var changeLegend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px',
    width: '600px',  // Fixed missing 'px' unit
    margin: '0 10px 0 0'  // Added margin for spacing
  }
});
// Add legend title
var legendTitle = ui.Label({
  value: 'Change Detection',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',  // Reduced from 18px for consistency
    margin: '0 0 8px 0',
    padding: '0',
    textAlign: 'left'  // Changed from center to left
  }
});
changeLegend.add(legendTitle);
// Create container for three columns
var columnsContainer = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {stretch: 'horizontal'}
});
// Calculate items distribution (25 total = 9/8/8)
var itemsPerColumn = Math.ceil(classArray.length * classArray.length / 3);
// Generate three columns
for (var col = 0; col < 3; col++) {
  var column = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
      width: '33%',
      padding: '0 5px'
    }
  });
  var startIdx = col * itemsPerColumn;
  var endIdx = Math.min(startIdx + itemsPerColumn, classArray.length * classArray.length);
  
  for (var idx = startIdx; idx < endIdx; idx++) {
    var i = Math.floor(idx / classArray.length);
    var j = idx % classArray.length;
    
    var colorIndex = classArray.length * i + j;  // Simplified calculation
    
    // Create color swatch
    var colorBox = ui.Label({
      style: {
        backgroundColor: classificationchangepalette[colorIndex],
        padding: '8px',
        margin: '0 0 4px 0',
        width: '20px',
        height: '20px'  // Added fixed height
      }
    });
    // Create description label
    var description = ui.Label({
      value: classArray[i] + ' → ' + classArray[j],
      style: {
        margin: '0 0 4px 6px',
        fontSize: '12px',
        whiteSpace: 'nowrap'  // Prevent text wrapping
      }
    });
    // Create row panel
    var row = ui.Panel({
      widgets: [colorBox, description],
      layout: ui.Panel.Layout.flow('horizontal')
    });
    column.add(row);
  }
  columnsContainer.add(column);
}
changeLegend.add(columnsContainer);
Map.add(changeLegend);
//***********************************************************************************************************************************************************************//
//********** Section 9 - Compute the statistics of the classification changes results; mainly the most common value of changes within the buffer extent for each site
//********** and the frequancy weight for each class change in the area of site of interest *****************************************************************************//
//***********************************************************************************************************************************************************************//
changesPerSite = changes.reduceRegions({
    collection: Sites_buffer,
    reducer: (ee.Reducer.mode({maxRaw:9999})
    .combine({
    reducer2: ee.Reducer.toList(),
    sharedInputs: true})
    .combine({
    reducer2: ee.Reducer.frequencyHistogram(),
  sharedInputs: true
})),
    scale: 10,
});
print(changesPerSite, 'changesPerSite');
// // Specify the class value to select sites with a particular threat or change 
// var Sites_underThreat_ofClass = changesPerSite.filter(ee.Filter.listContains('list', 4));
// print (Sites_underThreat_ofClass, 'Sites_underThreat_ofClass');
// // To add a feature polygon displayed with a hollow polygon, the footprint of each polygon is converted to an image
// // this step is not necessary, it is only needed for visualization 
// var Sites_underThreat = empty.paint({
//   featureCollection: Sites_underThreat_ofClass,
//   color: 1,
//   width: 3
// });
// Map.addLayer(Sites_underThreat, {color: 'black'},'Sites_under_Threat_of_Class_Change',false);
//*********************************************************************************************************//
// Export Feature Collections for sites under change and threat
//*********************************************************************************************************//
//Export the changesPerSite shapefile
Export.table.toDrive({
  collection: changesPerSite,
  description: 'changesPerSite',
  fileFormat: 'SHP'
});
// Plot the classification change mode results for all of the sites in the study area
// Define the chart and print it to the console.
var changeticks = [];
for (var i = 0; i < classArray.length; i++) {
    for (var j = 0; j < classArray.length; j++) {
        var tickValue = i * classArray.length + j + 1;
        var tickLabel = classArray[i] + '_To_' + classArray[j];
        changeticks.push({ v: tickValue, f: tickLabel });
    }
}
// Print the generated ticks with a name/label
print('List of Classification Change and Values:', changeticks);
var changesPerSitechart = ui.Chart.feature.histogram(changesPerSite, 'mode')
                  .setOptions({
                  title: 'Sites under Different Threats and Land Cover Changes', titleTextStyle: {fontSize:35, italic: false, bold: true},
                  colors: ['1d6b99', 'cf513e'],
                  pointSize: 7,
                  dataOpacity: 0.4,
                  hAxis: {'title': 'Threat and Land Cover Change',titleTextStyle: {fontSize: 30, italic: false, bold: true},slantedTextAngle:90,
                  ticks: changeticks,
                  textStyle: {fontSize: 30, bold: true}},
                  vAxis: {'title': 'Number of Sites',titleTextStyle: {fontSize: 30, italic: false, bold: true}, textStyle: {fontSize: 30, bold: true}},
                  legend:{titleTextStyle: {fontSize: 30, italic: false, bold: true}},
            });
print(changesPerSitechart);
//*************************************************************************************//
// This snippet has been modified using DeepSeek AI model to automate the selection of classification changes and detected threats//
// Initialize UI if first run
  if (!changeSelector) {
    setupChangeAnalysisUI();
    
    // Create new panel for change analysis
    var changeAnalysisPanel = ui.Panel([
      changeAnalysisLabel,
      changeSelector,
      analyzeButton
    ], ui.Panel.Layout.flow('vertical'));
    
    // Add to main UI
    UserInterfacepanel.add(changeAnalysisPanel);
  }
// Enable analysis
  analyzeButton.setDisabled(false);
  analyzeButton.onClick(analyzeSelectedChanges); 
});// This is for the end of Stage 2, i.e. RunButton2
// ===== ANALYSIS FUNCTION =====
function analyzeSelectedChanges() {
  if (!changes || !changesPerSite) {
    print('Please complete Stage 2 processing first');
    return;
  }

  var selectedLabel = changeSelector.getValue();
  if (!selectedLabel) {
    print('Please select a change type');
    return;
  }

  try {
    // Calculate change value
    var parts = selectedLabel.split(" to ");
    var fromIndex = classArray.indexOf(parts[0]);
    var toIndex = classArray.indexOf(parts[1]);
    var selectedValue = classValues.length * fromIndex + toIndex + 1;
    
    // Get the masked change pixels and threatened sites
    var selectedChange = changes.updateMask(changes.eq(selectedValue));
    var threatenedSites = changesPerSite.filter(
      ee.Filter.listContains('list', selectedValue)
    );
    
    // Debug output with selectedLabel
    threatenedSites.size().evaluate(function(count) {
      print('Threatened sites count (' + selectedLabel + '):', count);
      if (count > 0) {
        threatenedSites.getInfo(function(features) {
          print('Threatened Sites (' + selectedLabel + '):', features);
        });
      }
    });
    
    // Visualize change areas
    Map.addLayer(
      selectedChange.gt(0).selfMask(),
      {
        min: 0,
        max: 1,
        palette: ['ff2000'],
        opacity: 0.7
      },
      'Change Areas: ' + selectedLabel
    );
    
    // Visualize threatened sites with selectedLabel in layer name
    Map.addLayer(
      ee.Image().byte().paint({
        featureCollection: threatenedSites,
        color: 1,
        width: 3
      }),
      {palette: ['blue']},
      'Threatened Sites: ' + selectedLabel
    );
    
    // Export results
    Export.table.toDrive({
      collection: ee.FeatureCollection(threatenedSites),
      description: 'Sites_underThreat_' + selectedLabel.replace(/ /g,'_'),
      fileFormat: 'SHP',
      folder: 'GEEFolder'
    });

  } catch (e) {
    print('Error during analysis:', e);
  }
}
//*************************************************
});// This is for the end of Stage 1, i.e. RunButton1 
// //*******************************************************************************************************************************//
// //**************************************** Section 10 - ACD User Interface ******************************************************//
// // In this section we create a graphical user interface that will allow users to easily interact with the EAMENA MLACD
// // by using panels and layouts to hold the widgets used to display the elements and results generated from the EAMENA MLACD script
// //******************************************************************************************************************************//
//*************************** Define all elements and widgets used to display the ACD results on the user interface panel *********//
// Create a panel with vertical flow layout
var UserInterfacepanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {width: '28%'}
});
// Create a title label for the ACD web User Interface 
var UserInterfacetitle = ui.Label({value:'Monitoring Archaeological Sites using EAMENA MLACD',
   style: {fontSize: 30, fontWeight: 'bold', position: 'top-left'}});
// Create a button to reset everything
var ResetButton = ui.Button({
  label: 'Reset',
}); 
// Description of the EAMENA ACD 
var EAMENA_ACD_Description = ui.Label({value:'The Machine Learning Automated Change Detection (MLACD) tool leverages freely available satellite imagery and the high-performance computing capabilities of Google Earth Engine to analyze time-series Sentinel-2 images. By comparing sequential images, the tool detects and determines areas of change, identifying where, when, and what types of changes have occurred within the vicinity of known archaeological sites.',
   style: {fontSize: 40, fontWeight: 'bold'}});
// Create a user interface widget to allow users to import dates of interest
var Dateslabel = ui.Label({value:'1-Define the start and end dates of the study period',
    style:{fontSize: 40, fontWeight: 'bold'}});
var startDatelabel = ui.Label({value:'Define the start date in the following format: e.g. 2020-01-21.',
    style:{fontSize: 30, fontWeight: 'bold'}});
var endDatelabel = ui.Label({value:'Define the end date in the following format: e.g. 2023-12-31.',
    style:{fontSize: 30, fontWeight: 'bold'}});    
var featureBufferlabel = ui.Label({value:'2-Define the feature buffer distance in meters, e.g. 50m. Note that the buffer function will not accept a null distance; 0 meter in that case you must specify a small decimal fraction number e.g. 0.1m.',
    style:{fontSize: 30, fontWeight: 'bold'}}); 
var FirstRunButtonLabel =  ui.Label({value:'3-Press the "Run" button to excecute the first stage of the processing.',
    style:{fontSize: 30, fontWeight: 'bold'}});
var ImageDateslabel = ui.Label({value:'4-Choose your Image Dates',
    style:{fontSize: 40, fontWeight: 'bold'}});
var first_ImageIDlabel = ui.Label({value:'*from the drop down menu select the First Image Date*',
    style:{fontSize: 30, fontWeight: 'bold'}}); 
var second_ImageIDlabel = ui.Label({value:'*from the drop down menu select the Second Image Date*',
    style:{fontSize: 30, fontWeight: 'bold'}});
var SecondRunButtonLabel =  ui.Label({value:'5-Press the second "Run" button to excecute the second stage of the processing.',
    style:{fontSize: 30, fontWeight: 'bold'}});
var ResetButtonLabel = ui.Label({value:'*Optional-Press the "Rest" button to redefine your inputs.',
    style:{fontSize: 30, fontWeight: 'bold'}});
// Reset the map panel to allow for new diplay for the new results
ResetButton.onClick(function() {
    startDate.setValue('');
    endDate.setValue('');
    featureBuffer.setValue('');
    Map.clear();
    Map.drawingTools().clear();
});
//***************************************  Display the User Interface Panel ***************************************************************//
UserInterfacepanel.add(UserInterfacetitle) // add a user interface title to the user interface panel
      // .add(EAMENA_Logolabel)
      .add(EAMENA_ACD_Description)
      .add(Dateslabel)
      .add(startDatelabel)
      .add(startDate)
      .add(endDatelabel)
      .add(endDate)
      .add(featureBufferlabel)
      .add(featureBuffer)
      .add(FirstRunButtonLabel)
      .add(RunButton)
      .add(ImageDateslabel)
      .add(first_ImageIDlabel)
      .add(second_ImageIDlabel)
      .add(SecondRunButtonLabel)
      .add(RunButton2)
      .add(ResetButtonLabel)
      .add(ResetButton);
// // Add the panel to the user interface root
ui.root.insert(0, UserInterfacepanel); 
//*****************************************************************************************************************************************//
