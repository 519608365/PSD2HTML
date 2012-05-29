// @include "json2-min.jsx"
// @include "web-fonts.jsx"

//setting for app preferences
app.preferences.rulerUnits = Units.PIXELS;
app.preferences.typeUnits = TypeUnits.PIXELS;
     

function PSD(option){
	this.doc = app.activeDocument;
	this.docs = app.documents;
	this.tree = {name:this.doc.name, imgCount:0, childs:[]};
	this.textLayers = [];        //�洢���е��ı�ͼ��
	this.linkReg = /^[aA]$|^[aA]-/;
	this.layers = this.doc.layers;
	this.option = {
		exportImages: false,		//�Ƿ񵼳�ͼƬ
		output: File($.fileName).parent.parent+'/output/'
	}
	if(option){
		for(k in option){
			this.option[k] = option[k];
		}
	}
	this._init();
}


(function(){

var _index = -1,
	_sliceCount = 0,
	_textLayersInfo = [],
	_slices = [];

PSD.fn = PSD.prototype = {
	_init: function(){
		this.output = Folder(this.option.output);
		!this.output.exists && this.output.create();

		this.dir = Folder(this.output + '/' + this.getPSDName());
		!this.dir.exists && this.dir.create();
	},
	parseLayers: function(layers, context, skip){
		layers = layers || this.layers;
	
		if(this.option.exportImages){
			this.layersImgs = new Folder(this.dir + '/layersImgs/');
			!this.layersImgs.exists && this.layersImgs.create();
		}
		
		for(var i = layers.length - 1; i >= 0; i--){
			var layer = layers[i];
			this._getLayerInfo(layer, context, skip);
		}
	},
	getWidth: function(){
		return this.doc.width.value;
	},
	getHeight: function(){
		return this.doc.height.value;
	},
	getPSDName: function(){
		return this.doc.name.substr (0, this.doc.name.length - 4);
	},
	getEffects: function(){
	    var ref = new ActionReference();
		var effects = [];
	    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));

	    var desc = executeActionGet(ref);
	    if (desc.hasKey( stringIDToTypeID('layerEffects'))){
	        var effectDesc = desc.getObjectValue(stringIDToTypeID('layerEffects'));
	        // first key is scale so skip and start with 1
	        for ( var effect = 1; effect < effectDesc.count; effect++ ){
	            effects.push(typeIDToStringID(effectDesc.getKey(effect )));
	        }
	    }
	    return effects;
	},
	_getLayerInfo: function(layer, context, skip){
		_index++;
		
		context = context || this.tree;
		
		if(layer.typename === 'ArtLayer' && layer.visible === true){
			try{
				if(skip && skip(layer)) return;
			}catch(e){}
			
			this.doc.activeLayer = layer;
			/* get layer bounds, fix layer bounds */
			var bounds = layer.bounds,
				left = bounds[0].value,
				left = left > 0 ? left : 0;
				right = bounds[2].value,
				right = right < this.doc.width.value ? right : this.doc.width.value,
				top = bounds[1].value,
				top = top > 0 ? bounds[1].value : 0,
				bottom = bounds[3].value,
				bottom = bottom < this.doc.height.value ? bottom : this.doc.height.value;

			if(right <= left || top >= bottom) return;		

			var kind = layer.kind.toString();
			var child = {
				type:layer.typename, 
				name:layer.name, 
				visible:layer.visible, 
				left:left, top:top, 
				right:right, bottom:bottom, 
				kind:kind,
				isBackgroundLayer: layer.isBackgroundLayer,
				index: _index
			}

			if(kind === 'LayerKind.TEXT'){
				var textItem = layer.textItem;
				// ��try catchʵ����������ͼ�����ı�ʱ������textItem.font��textItem.contents���쳣���޷������жϡ�
				try{
					if(WEBFONTS.indexOf(textItem.font) < 0 || this.getEffects().length > 0 || textItem.warpStyle !== WarpStyle.NONE){
						if(this.linkReg.test(layer.name)){
							child.link = {href: '#'};
							child.textInfo = undefined;
							_textLayersInfo.push(child);
						}
						return;
					}
				}catch(e){
					return;
				}
				try{
					if(textItem.kind == TextType.PARAGRAPHTEXT){
						child.width = layer.textItem.width.value;
						child.height = layer.textItem.height.value;
					}

					child.textInfo = {
						color: textItem.color.rgb.hexValue, 
						contents:textItem.contents, 
						font: WEBFONTS.getWebFont(textItem.font), 
						size: Math.round(textItem.size.value),
						textType: textItem.kind.toString(),
						bold: textItem.fauxBold,
						italic: textItem.fauxItalic,
						indent: Math.round(textItem.firstLineIndent.value)
					};
					// line height
					if(!textItem.useAutoLeading){
						child.textInfo.lineHeight = Math.round(textItem.leading.value);
					}else{
						child.textInfo.lineHeight = Math.round(textItem.autoLeadingAmount) + '%';
					}
					// text justification
					switch(textItem.justification){
						case 'Justification.LEFT':
							child.textInfo.textAlign = 'left';
							break;
						case 'Justification.RIGHT':
							child.textInfo.textAlign = 'right';
							break;
						case 'Justification.CENTER':
							child.textInfo.textAlign = 'certer';
							break;
						case 'Justification.CENTERJUSTIFIED':
						case 'Justification.FULLYJUSTIFIED':
						case 'Justification.LEFTJUSTIFIED':
						case 'Justification.RIGHTJUSTIFIED':
							child.textInfo.textAlign = 'justify';
							break;
						default:
							child.textInfo.textAlign = 'left';

					}
					// link
					if(this.linkReg.test(layer.name)){
						child.link = {href: '#'};
					}
				
					this.textLayers.push(layer);
					_textLayersInfo.push(child);
					
				}catch(e){return;}
			}else{
				// link
				if(this.linkReg.test(layer.name)){
					child.link = {href: '#'};
					child.kind = 'LayerKind.TEXT';
					_textLayersInfo.push(child);
				}

				this.tree.imgCount++;
				if(this.option.exportImages){
					this.exportImage(layer, _index);
				}
			}
            context.childs.push(child);
			
		}else if(layer.typename == 'LayerSet' && layer.visible === true){
				
			var o = {type:layer.typename, name:layer.name, index:_index, childs:[]};
			context.childs.push(o);
			this.parseLayers(layer.layers, o, skip);
		}
	},
	exportPng: function(){
		this.hiddenTextLayers();
		var img= new File(this.dir+"/psd.png");
		var options = new ExportOptionsSaveForWeb();
		options.format = SaveDocumentType.PNG;
		options.PNG8 = false;
		this.doc.exportDocument (img, ExportType.SAVEFORWEB, options);
		//$.writeln(img.length);
		this.visibleTextLayers();
		return img;
		//this.visibleTextLayers();
	},
	exportImage: function(layer, index){
		this.hiddenTextLayers();
		try{
			var bounds = layer.bounds;
			layer.copy();
			layerWidth = UnitValue(bounds[2].value - bounds[0].value, 'px'),
			layerHeight = UnitValue(bounds[3].value - bounds[1].value, 'px');
			var newDoc = this.docs.add(layerWidth, layerHeight);
			newDoc.paste();
			newDoc.layers[newDoc.layers.length - 1].remove();
			
			var img= new File(this.imagesFolder + "/layer_"+_index+".png");
			var options = new ExportOptionsSaveForWeb();
			options.format = SaveDocumentType.PNG;
			newDoc.exportDocument (img, ExportType.SAVEFORWEB, options);
			newDoc.close(SaveOptions.DONOTSAVECHANGES);
		}catch(e){	//TODO Ŀǰ���־����ɲ��ͼ���޷�ִ��layer.copy();
			alert(e+'#####'+layer.name);
		}
		this.visibleTextLayers();
	},
	exportJSON: function(data, format){
		var f = new File(this.dir + "/json.txt");
		f.encoding = format || 'UTF-8';
		f.open('w', 'TEXT');
		f.write(JSON.stringify(data || this.tree));
		f.close();
	},
	getJSON: function(){
		return this.tree;
	},
	hiddenTextLayers: function(){
		for(var i = 0, l = this.textLayers.length; i < l; i++){
			if(!this.textLayers[i].visible) continue;
			this.textLayers[i].visible = false;
		}
	},
	visibleTextLayers: function(){
		for(var i = 0, l = this.textLayers.length; i < l; i++){
			if(this.textLayers[i].visible) continue;
			this.textLayers[i].visible = true;
		}
	},
	/* �Զ���Ƭ������ͼƬ */
	autoSliceAndExport: function(options, height){
		this.hiddenTextLayers();
		
		if(!options){
			options = new ExportOptionsSaveForWeb();
			options.format = SaveDocumentType.JPEG;
			options.quality = 60;
		}
		var extension = 'jpg';
		if(options.format == SaveDocumentType.PNG){
			extension = 'png';
		}
		
		if(!height){
			// ���ɲ���ͼƬ���Ա����ÿ����Ƭ�ĸ߶�
			var testImg = File(this.dir + '/' + 'img.tmp.' + extension);
			this.doc.exportDocument (testImg, ExportType.SAVEFORWEB, options);
			var size = testImg.length, HEIGHT = 120;
			
			if(size < 70000){
				HEIGHT = this.getHeight();
			}else{
				HEIGHT = Math.round(this.getHeight() / Math.ceil(size / 100000));
			}
			testImg.remove();	//ɾ������ͼƬ
		}else{
			var HEIGHT = height;
		}
		
		var	selection = this.doc.selection,
			docWidth = this.doc.width.value,
			docHeight = this.doc.height.value,
			region = [],
			y = 0, fy;
			

		var slicesFolder = new Folder(this.dir + '/slices/');
		!slicesFolder.exists && slicesFolder.create();
		
		try{
			while(y < docHeight){
				_index++;

				y = y + HEIGHT;
				fy = y > docHeight ? docHeight : y;
				region = [[0, y - HEIGHT], [docWidth, y - HEIGHT], [docWidth, fy], [0, fy]];
				selection.select(region);
				selection.copy(true);
				
				var newDoc = this.docs.add(docWidth, HEIGHT - (y - fy));
				newDoc.paste();
				newDoc.layers[newDoc.layers.length - 1].remove();
				
				var img = new File(slicesFolder + "/slice_" + _index + "." + extension);
				newDoc.exportDocument (img, ExportType.SAVEFORWEB, options);
				newDoc.close(SaveOptions.DONOTSAVECHANGES);

				_slices.push({index:_index, type:"ArtLayer", visible:true, kind:"LayerKind.NORMAL", isBackgroundLayer:false,
					name:'slice_'+_index+'.'+extension, right: docWidth, top:y - HEIGHT, left:0, bottom:fy});
				_sliceCount++;
			}
			selection.deselect();
		}catch(e){
			// TODO
		}
		this.visibleTextLayers();
		return _slices;
	},
	getTextLayersAndSlices: function(option, height){
		if(_slices.length <= 0) this.autoSliceAndExport(option, height);
		var data = {name: this.doc.name, imgCount:_sliceCount, childs:_slices.concat(_textLayersInfo)};
		//this.exportJSON(data);
		return data;
	},
	/* ��ȡ�����ı�ͼ����Ϣ��return Array */
	getTextLayers: function(){
		return _textLayersInfo;
	}
}

})();
