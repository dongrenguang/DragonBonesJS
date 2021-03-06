namespace dragonBones {
    type GroupConfig = {
        name: string,
        version: number,

        position: number[],

        display: DisplayConfig[],
        frame: FrameConfig[],
        movie: MovieConfig[],

        // Runtime
        offset?: number,
        arrayBuffer?: ArrayBuffer,
        displayFrameArray?: Int16Array,
        rectangleArray?: Float32Array,
        transformArray?: Float32Array,
        colorArray?: Int8Array,
        textures?: egret.Texture[],
    };

    type DisplayConfig = {
        name: string,
        type: DisplayType,
        textureIndex?: number,
        regionIndex?: number

        // Runtime
        texture?: egret.Texture
    };

    type ActionAndEventConfig = {
        type: ActionType | EventType,
        name: string,
        data?: any,
        slot?: string
    };

    type MovieConfig = {
        name: string,
        frameRate: number,
        type?: number,
        action?: string,
        isNested?: boolean,

        slot?: SlotConfig[],
        clip?: ClipConfig[]
    };

    type SlotConfig = {
        name: string,
        blendMode?: BlendMode,
        action?: string
    };

    type ClipConfig = {
        name: string,
        playTimes: number,
        duration: number,
        scale: number,
        cacheTimeToFrameScale: number,
        p: number,
        s: number,

        frame?: number[],

        // Runtime
        cacheRectangles: egret.Rectangle[]
    };

    type FrameConfig = {
        prev: number,
        next: number,
        position: number,
        actionAndEvent: ActionAndEventConfig[]
    };

    type CreateMovieHelper = {
        groupName?: string,
        movieName: string,
        groupConfig?: GroupConfig,
        movieConfig?: MovieConfig
    };

    class Slot extends egret.HashObject {
        public displayIndex: number = -1;
        public colorIndex: number = -1;
        public transformIndex: number = -1;
        public config: SlotConfig = null;
        public displayConfig: DisplayConfig = null;
        public display: egret.DisplayObject = null;
        public childMovie: Movie = null;
        public colorFilter: egret.ColorMatrixFilter = null;
        public rawDisplay: egret.Bitmap = new egret.Bitmap();
        public childMovies: Map<Movie> = {};

        public constructor(slotConfig: SlotConfig) {
            super();

            this.display = this.rawDisplay;
            this.config = slotConfig;
            this.rawDisplay.name = this.config.name;

            if (this.config.blendMode == null) {
                this.config.blendMode = BlendMode.Normal;
            }
        }

        public dispose(): void {
            this.config = null;
            this.displayConfig = null;
            this.display = null;
            this.childMovie = null;
            this.colorFilter = null;
            this.rawDisplay = null;
            this.childMovies = null;
        }
    }

    let _helpRectangle: egret.Rectangle = new egret.Rectangle();
    let _helpMatrix: egret.Matrix = new egret.Matrix();
    let _groupConfigMap: Map<GroupConfig> = {};

    function _findObjectInArray<T extends { name: string }>(array: T[], name: string): T {
        for (let i = 0, l = array.length; i < l; ++i) {
            const data = array[i];
            if (data.name == name) {
                return data;
            }
        }

        return null;
    }

    function _fillCreateMovieHelper(createMovieHelper: CreateMovieHelper): boolean {
        if (createMovieHelper.groupName) {
            const groupConfig = _groupConfigMap[createMovieHelper.groupName];
            if (groupConfig) {
                const movieConfig = _findObjectInArray(groupConfig.movie, createMovieHelper.movieName);
                if (movieConfig) {
                    createMovieHelper.groupConfig = groupConfig;
                    createMovieHelper.movieConfig = movieConfig;
                    return true;
                }
            }
        }

        if (!createMovieHelper.groupName) { // || autoSearch Will be search all data, if do not give a data name or the autoSearch is true.
            for (let groupName in _groupConfigMap) {
                const groupConfig = _groupConfigMap[groupName];
                if (!createMovieHelper.groupName) { // || groupConfig.autoSearch
                    const movieConfig = _findObjectInArray(groupConfig.movie, createMovieHelper.movieName);
                    if (movieConfig) {
                        createMovieHelper.groupName = groupName;
                        createMovieHelper.groupConfig = groupConfig;
                        createMovieHelper.movieConfig = movieConfig;
                        return true;
                    }
                }
            }
        }

        return false;
    }
    /**
     * @language zh_CN
     * 是否包含指定名称的动画组。
     * @param groupName 动画组的名称。
     * @version DragonBones 4.7
     */
    export function hasMovieGroup(groupName: string): boolean {
        return _groupConfigMap[groupName] != null;
    }
    /**
     * @language zh_CN
     * 添加动画组。
     * @param groupData 动画二进制数据。
     * @param textureAtlas 贴图集或贴图集列表。
     * @param groupName 为动画组指定一个名称，如果未设置，则使用数据中的名称。
     * @version DragonBones 4.7
     */
    export function addMovieGroup(groupData: ArrayBuffer, textureAtlas: egret.Texture | egret.Texture[], groupName: string = null): void {
        if (groupData) {
            const byteArray = new egret.ByteArray(groupData);
            byteArray.endian = egret.Endian.LITTLE_ENDIAN;
            byteArray.position = 8; // TODO format

            const groupConfig = <GroupConfig>JSON.parse(byteArray.readUTF());
            groupConfig.offset = byteArray.position;
            groupConfig.arrayBuffer = groupData;
            groupConfig.textures = [];

            const p = groupConfig.offset % 4;
            if (p) {
                groupConfig.offset += 4 - p;
            }

            for (let i = 0, l = groupConfig.position.length; i < l; i += 3) {
                switch (i / 3) {
                    case 1:
                        groupConfig.displayFrameArray = new Int16Array(groupConfig.arrayBuffer, groupConfig.offset + groupConfig.position[i], groupConfig.position[i + 1] / groupConfig.position[i + 2]);
                        break;
                    case 2:
                        groupConfig.rectangleArray = new Float32Array(groupConfig.arrayBuffer, groupConfig.offset + groupConfig.position[i], groupConfig.position[i + 1] / groupConfig.position[i + 2]);
                        break;
                    case 3:
                        groupConfig.transformArray = new Float32Array(groupConfig.arrayBuffer, groupConfig.offset + groupConfig.position[i], groupConfig.position[i + 1] / groupConfig.position[i + 2]);
                        break;
                    case 4:
                        groupConfig.colorArray = new Int16Array(groupConfig.arrayBuffer, groupConfig.offset + groupConfig.position[i], groupConfig.position[i + 1] / groupConfig.position[i + 2]);
                        break;
                }
            }

            groupName = groupName || groupConfig.name;
            if (_groupConfigMap[groupName]) {
                // TODO
            }

            _groupConfigMap[groupName] = groupConfig;

            //
            if (textureAtlas instanceof Array) {
                for (let i = 0, l = textureAtlas.length; i < l; ++i) {
                    const texture = textureAtlas[i];
                    groupConfig.textures.push(texture);
                }
            }
            else {
                groupConfig.textures.push(textureAtlas);
            }
        }
        else {
            throw new Error();
        }
    }
    /**
     * @language zh_CN
     * 移除动画组。
     * @param groupName 动画组的名称。
     * @version DragonBones 4.7
     */
    export function removeMovieGroup(groupName: string): void {
        const groupConfig = _groupConfigMap[groupName];
        if (groupConfig) {
            delete _groupConfigMap[groupName];
        }
    }
    /**
     * @language zh_CN
     * 移除所有的动画组。
     * @param groupName 动画组的名称。
     * @version DragonBones 4.7
     */
    export function removeAllMovieGroup(): void {
        for (let i in _groupConfigMap) {
            delete _groupConfigMap[i];
        }
    }
    /**
     * @language zh_CN
     * 创建一个动画。
     * @param movieName 动画的名称。
     * @param groupName 动画组的名称，如果未设置，将检索所有的动画组，当多个动画组中包含同名的动画时，可能无法创建出准确的动画。
     * @version DragonBones 4.7
     */
    export function buildMovie(movieName: string, groupName: string = null): Movie {
        const createMovieHelper = <CreateMovieHelper>{ movieName: movieName, groupName: groupName };
        if (_fillCreateMovieHelper(createMovieHelper)) {
            const movie = new Movie(createMovieHelper);
            return movie;
        }
        else {
            console.warn("No movie named: " + movieName);
        }

        return null;
    }
    /**
     * @language zh_CN
     * 获取指定动画组内包含的所有动画名称。
     * @param groupName 动画组的名称。
     * @version DragonBones 4.7
     */
    export function getMovieNames(groupName: string): string[] {
        const groupConfig = _groupConfigMap[groupName];
        if (groupConfig) {
            const movieNameGroup = <string[]>[];
            for (let i = 0, l = groupConfig.movie.length; i < l; ++i) {
                movieNameGroup.push(groupConfig.movie[i].name);
            }

            return movieNameGroup;
        }
        else {
            console.warn("No group named: " + groupName);
        }

        return null;
    }
    /**
     * @language zh_CN
     * 动画事件。
     * @version DragonBones 4.7
     */
    export class MovieEvent extends egret.Event {
        /**
         * @language zh_CN
         * 动画剪辑开始播放。
         * @version DragonBones 4.7
         */
        public static START: string = "start";
        /**
         * @language zh_CN
         * 动画剪辑循环播放一次完成。
         * @version DragonBones 4.7
         */
        public static LOOP_COMPLETE: string = "loopComplete";
        /**
         * @language zh_CN
         * 动画剪辑播放完成。
         * @version DragonBones 4.7
         */
        public static COMPLETE: string = "complete";
        /**
         * @language zh_CN
         * 动画剪辑帧事件。
         * @version DragonBones 4.7
         */
        public static FRAME_EVENT: string = "frameEvent";
        /**
         * @language zh_CN
         * 动画剪辑声音事件。
         * @version DragonBones 4.7
         */
        public static SOUND_EVENT: string = "soundEvent";
        /**
         * @language zh_CN
         * 事件名称。 (帧标签的名称或声音的名称)
         * @version DragonBones 4.7
         */
        public name: string = null;
        /**
         * @language zh_CN
         * 发出事件的插槽名称。
         * @version DragonBones 4.7
         */
        public slotName: string = null;
        /**
         * @language zh_CN
         * 发出事件的动画剪辑名称。
         * @version DragonBones 4.7
         */
        public clipName: string = null;
        /**
         * @language zh_CN
         * 发出事件的动画。
         * @version DragonBones 4.7
         */
        public movie: Movie = null;
        /**
         * @private
         */
        public constructor(type: string) {
            super(type);
        }
    }
    /**
     * @language zh_CN
     * 通过读取缓存的二进制动画数据来更新动画，具有良好的运行性能，同时对内存的占用也非常低。
     * @see dragonBones.buildMovie
     * @version DragonBones 4.7
     */
    export class Movie extends egret.DisplayObjectContainer implements IAnimateble {
        private static _cleanBeforeRender(): void { }
        /**
         * @language zh_CN
         * 动画的播放速度。 [(-N~0): 倒转播放, 0: 停止播放, (0~1): 慢速播放, 1: 正常播放, (1~N): 快速播放]
         * @default 1
         * @version DragonBones 4.7
         */
        public timeScale: number = 1;
        /**
         * @language zh_CN
         * 动画剪辑的播放速度。 [(-N~0): 倒转播放, 0: 停止播放, (0~1): 慢速播放, 1: 正常播放, (1~N): 快速播放]
         * （当再次播放其他动画剪辑时，此值将被重置为 1）
         * @default 1
         * @version DragonBones 4.7
         */
        public clipTimeScale: number = 1;

        private _batchEnabled: boolean = true;
        private _isLockDispose: boolean = false;
        private _isDelayDispose: boolean = false;
        private _isStarted: boolean = false;
        private _isPlaying: boolean = false;
        private _isReversing: boolean = false;
        private _isCompleted: boolean = false;
        private _playTimes: number = 0;
        private _time: number = 0;
        private _currentTime: number = 0;
        private _timeStamp: number = 0;
        private _currentPlayTimes: number = 0;
        private _cacheFrameIndex: number = 0;
        private _frameSize: number = 0;
        private _cacheRectangle: egret.Rectangle = null;

        private _groupConfig: GroupConfig = null;
        private _config: MovieConfig = null;
        private _clipConfig: ClipConfig = null;
        private _currentFrameConfig: FrameConfig = null;
        private _clipArray: Int16Array = null;

        private _clipNames: string[] = [];
        private _slots: Slot[] = [];
        private _childMovies: Movie[] = [];
        /**
         * @internal
         * @private
         */
        public constructor(createMovieHelper: any) {
            super();

            this._groupConfig = (<CreateMovieHelper>createMovieHelper).groupConfig;
            this._config = (<CreateMovieHelper>createMovieHelper).movieConfig;

            this._batchEnabled = !this._config.isNested;

            if (this._batchEnabled) {
                this.$renderNode = new egret.sys.GroupNode();
                this.$renderNode.cleanBeforeRender = Movie._cleanBeforeRender;
            }

            this._clipNames.length = 0;
            for (let i = 0, l = this._config.clip.length; i < l; ++i) {
                this._clipNames.push(this._config.clip[i].name);
            }

            for (let i = 0, l = this._config.slot.length; i < l; ++i) {
                const slot = new Slot(this._config.slot[i]);
                this._updateSlotBlendMode(slot);
                this._slots.push(slot);

                if (this._batchEnabled) {
                    (<egret.sys.GroupNode>this.$renderNode).addNode(slot.rawDisplay.$renderNode);
                }
                else {
                    this.addChild(slot.rawDisplay);
                }
            }

            this._frameSize = (1 + 1) * this._slots.length; // displayFrame, transformFrame.

            EgretFactory.factory; //
            this.advanceTimeBySelf(true);
            this.name = this._config.name;
            this.play();
            this.advanceTime(0.000001);
            this.stop();
        }

        private _configToEvent(config: ActionAndEventConfig, event: MovieEvent): void {
            event.movie = this;
            event.clipName = this._clipConfig.name;
            event.name = config.name;
            event.slotName = config.slot;
        }

        private _onCrossFrame(frameConfig: FrameConfig): void {
            for (let i = 0, l = frameConfig.actionAndEvent.length; i < l; ++i) {
                const actionAndEvent = frameConfig.actionAndEvent[i];
                if (actionAndEvent) {
                    switch (actionAndEvent.type) {
                        case EventType.Sound:
                            if (EgretFactory.factory.soundEventManater.hasEventListener(MovieEvent.SOUND_EVENT)) {
                                const event = egret.Event.create(MovieEvent, MovieEvent.SOUND_EVENT);
                                this._configToEvent(actionAndEvent, event);
                                EgretFactory.factory.soundEventManater.dispatchEvent(event);
                                egret.Event.release(event);
                            }
                            break;

                        case EventType.Frame:
                            if (this.hasEventListener(MovieEvent.FRAME_EVENT)) {
                                const event = egret.Event.create(MovieEvent, MovieEvent.FRAME_EVENT);
                                this._configToEvent(actionAndEvent, event);
                                this.dispatchEvent(event);
                                egret.Event.release(event);
                            }
                            break;

                        case ActionType.Play:
                        case ActionType.FadeIn:
                            if (actionAndEvent.slot) {
                                const slot = this._getSlot(actionAndEvent.slot);
                                if (slot && slot.childMovie) {
                                    slot.childMovie.play(actionAndEvent.name);
                                }
                            }
                            else {
                                this.play(actionAndEvent.name);
                            }
                            break;

                        case ActionType.Stop:
                            // TODO
                            break;

                        case ActionType.GotoAndPlay:
                            // TODO
                            break;

                        case ActionType.GotoAndStop:
                            // TODO
                            break;
                    }
                }
            }
        }

        private _updateSlotBlendMode(slot: Slot): void {
            let blendMode = "";

            switch (slot.config.blendMode) {
                case BlendMode.Normal:
                    blendMode = egret.BlendMode.NORMAL;
                    break;

                case BlendMode.Add:
                    blendMode = egret.BlendMode.ADD;
                    break;

                case BlendMode.Erase:
                    blendMode = egret.BlendMode.ERASE;
                    break;

                default:
                    break;
            }

            if (blendMode) {
                if (this._batchEnabled) {
                    // RenderNode display.
                    (<egret.sys.BitmapNode>slot.display.$renderNode).blendMode = egret.sys.blendModeToNumber(blendMode);
                }
                else {
                    // Classic display.
                    slot.display.blendMode = blendMode;
                }
            }
        }

        private _updateSlotColor(slot: Slot, aM: number, rM: number, gM: number, bM: number, aO: number, rO: number, gO: number, bO: number): void {
            if (
                rM != 1 ||
                gM != 1 ||
                bM != 1 ||
                rO != 0 ||
                gO != 0 ||
                bO != 0 ||
                aO != 0
            ) {
                if (!slot.colorFilter) {
                    slot.colorFilter = new egret.ColorMatrixFilter();
                }

                const colorMatrix = slot.colorFilter.matrix;
                colorMatrix[0] = rM;
                colorMatrix[6] = gM;
                colorMatrix[12] = bM;
                colorMatrix[18] = aM;
                colorMatrix[4] = rO;
                colorMatrix[9] = gO;
                colorMatrix[14] = bO;
                colorMatrix[19] = aO;

                slot.colorFilter.matrix = colorMatrix;

                if (this._batchEnabled) {
                    // RenderNode display.
                    let filter = (<egret.sys.BitmapNode>slot.display.$renderNode).filter;
                    (<egret.sys.BitmapNode>slot.display.$renderNode).filter = slot.colorFilter;
                }
                else {
                    // Classic display.
                    let filters = slot.display.filters;
                    if (!filters) {
                        filters = [];
                    }

                    if (filters.indexOf(slot.colorFilter) < 0) {
                        filters.push(slot.colorFilter);
                    }

                    slot.display.filters = filters;
                }
            }
            else {
                if (slot.colorFilter) {
                    slot.colorFilter = null;
                }

                if (this._batchEnabled) {
                    // RenderNode display.
                    (<egret.sys.BitmapNode>slot.display.$renderNode).filter = null;
                    (<egret.sys.BitmapNode>slot.display.$renderNode).alpha = aM;
                }
                else {
                    // Classic display.
                    slot.display.filters = null;
                    slot.display.$setAlpha(aM);
                }
            }
        }

        private _updateSlotDisplay(slot: Slot): void {
            const prevDisplay = slot.display || slot.rawDisplay;
            const prevChildMovie = slot.childMovie;

            if (slot.displayIndex >= 0) {
                slot.displayConfig = this._groupConfig.display[slot.displayIndex];
                if (slot.displayConfig.type == DisplayType.Armature) {
                    let childMovie = slot.childMovies[slot.displayConfig.name];

                    if (!childMovie) {
                        childMovie = buildMovie(slot.displayConfig.name, this._groupConfig.name);
                        childMovie.advanceTimeBySelf(false);
                        slot.childMovies[slot.displayConfig.name] = childMovie;
                    }

                    slot.display = childMovie;
                    slot.childMovie = childMovie;
                }
                else {
                    slot.display = slot.rawDisplay;
                    slot.childMovie = null;
                }
            }
            else {
                slot.displayConfig = null;
                slot.display = slot.rawDisplay;
                slot.childMovie = null;
            }

            if (slot.display != prevDisplay) {
                if (prevDisplay) {
                    this.addChild(slot.display);
                    this.swapChildren(slot.display, prevDisplay);
                    this.removeChild(prevDisplay);
                }

                // Update blendMode.
                this._updateSlotBlendMode(slot);
            }

            // Update frame.
            if (slot.display == slot.rawDisplay) {
                if (slot.displayConfig && slot.displayConfig.regionIndex != null) {
                    if (!slot.displayConfig.texture) {
                        const textureAtlasTexture = this._groupConfig.textures[0]; // TODO
                        const regionIndex = slot.displayConfig.regionIndex * 4;
                        const x = this._groupConfig.rectangleArray[regionIndex];
                        const y = this._groupConfig.rectangleArray[regionIndex + 1];
                        const width = this._groupConfig.rectangleArray[regionIndex + 2];
                        const height = this._groupConfig.rectangleArray[regionIndex + 3];

                        slot.displayConfig.texture = new egret.Texture();
                        slot.displayConfig.texture._bitmapData = textureAtlasTexture._bitmapData;
                        slot.displayConfig.texture.$initData(
                            x, y,
                            Math.min(width, textureAtlasTexture.textureWidth - x), Math.min(height, textureAtlasTexture.textureHeight - y),
                            0, 0,
                            Math.min(width, textureAtlasTexture.textureWidth - x), Math.min(height, textureAtlasTexture.textureHeight - y),
                            textureAtlasTexture.textureWidth, textureAtlasTexture.textureHeight
                        );
                    }
                    if (this._batchEnabled) {
                        // RenderNode display.
                        const texture = slot.displayConfig.texture;
                        const bitmapNode = slot.rawDisplay.$renderNode as egret.sys.BitmapNode;
                        egret.sys.RenderNode.prototype.cleanBeforeRender.call(slot.rawDisplay.$renderNode);
                        bitmapNode.image = texture._bitmapData;

                        bitmapNode.drawImage(
                            texture._bitmapX, texture._bitmapY,
                            texture._bitmapWidth, texture._bitmapHeight,
                            texture._offsetX, texture._offsetY,
                            texture.textureWidth, texture.textureHeight
                        );

                        bitmapNode.imageWidth = texture._sourceWidth;
                        bitmapNode.imageHeight = texture._sourceHeight;
                    }
                    else {
                        // Classic display.
                        slot.rawDisplay.visible = true;
                        slot.rawDisplay.$setBitmapData(slot.displayConfig.texture);
                    }
                }
                else {
                    if (this._batchEnabled) {
                        // RenderNode display.
                        (<egret.sys.BitmapNode>slot.rawDisplay.$renderNode).image = null;
                    }
                    else {
                        // Classic display.
                        slot.rawDisplay.visible = false;
                        slot.rawDisplay.$setBitmapData(null);
                    }
                }
            }

            // Update child movie.
            if (slot.childMovie != prevChildMovie) {
                if (prevChildMovie) {
                    prevChildMovie.stop();
                    this._childMovies.slice(this._childMovies.indexOf(prevChildMovie), 1);
                }

                if (slot.childMovie) {
                    if (this._childMovies.indexOf(slot.childMovie) < 0) {
                        this._childMovies.push(slot.childMovie);
                    }

                    if (slot.config.action) {
                        slot.childMovie.play(slot.config.action);
                    }
                    else {
                        slot.childMovie.play(slot.childMovie._config.action);
                    }
                }
            }
        }

        private _getSlot(name: string): Slot {
            for (let i = 0, l = this._slots.length; i < l; ++i) {
                const slot = this._slots[i];
                if (slot.config.name == name) {
                    return slot;
                }
            }

            return null;
        }
        /**
         * @inheritDoc
         */
        $render(): void {
            if (this._batchEnabled) {
                // RenderNode display.
            }
            else {
                // Classic display.
                super.$render();
            }
        }
        /**
         * @inheritDoc
         */
        $measureContentBounds(bounds: egret.Rectangle): void {
            if (this._batchEnabled && this._cacheRectangle) {
                // RenderNode display.
                bounds.setTo(this._cacheRectangle.x, this._cacheRectangle.y, this._cacheRectangle.width - this._cacheRectangle.x, this._cacheRectangle.height - this._cacheRectangle.y);
            }
            else {
                // Classic display.
                super.$measureContentBounds(bounds);
            }
        }
        /**
         * @inheritDoc
         */
        $doAddChild(child: egret.DisplayObject, index: number, notifyListeners?: boolean): egret.DisplayObject {
            if (this._batchEnabled) {
                // RenderNode display.
                console.warn("Can not add child.");
                return null;
            }

            // Classic display.
            return super.$doAddChild(child, index, notifyListeners);
        }
        /**
         * @inheritDoc
         */
        $doRemoveChild(index: number, notifyListeners?: boolean): egret.DisplayObject {
            if (this._batchEnabled) {
                // RenderNode display.
                console.warn("Can not remove child.");
                return null;
            }

            // Classic display.
            return super.$doRemoveChild(index, notifyListeners);
        }
        /**
         * @language zh_CN
         * 释放动画。
         * @version DragonBones 3.0
         */
        public dispose(): void {
            if (this._isLockDispose) {
                this._isDelayDispose = true;
            }
            else {
                this.advanceTimeBySelf(false);

                for (let i = 0, l = this._slots.length; i < l; ++i) {
                    this._slots[i].dispose();
                }

                this._isPlaying = false;
                this._cacheRectangle = null;
                this._groupConfig = null;
                this._clipConfig = null;
                this._currentFrameConfig = null;
                this._clipNames = null;
                this._slots = null;
                this._childMovies = null;
            }
        }
        /**
         * @inheritDoc
         */
        public advanceTime(passedTime: number): void {
            if (!this._isPlaying) {
                return;
            }

            this._isLockDispose = true;
            if (passedTime < 0) {
                passedTime = -passedTime;
            }
            passedTime *= this.timeScale;
            this._time += passedTime * this.clipTimeScale;

            // Modify time.            
            const duration = this._clipConfig.duration;
            const totalTime = duration * this._playTimes;
            let currentTime = this._time;
            let currentPlayTimes = this._currentPlayTimes;
            if (this._playTimes > 0 && (currentTime >= totalTime || currentTime <= -totalTime)) {
                this._isCompleted = true;
                currentPlayTimes = this._playTimes;

                if (currentTime < 0) {
                    currentTime = 0;
                }
                else {
                    currentTime = duration;
                }
            }
            else {
                this._isCompleted = false;

                if (currentTime < 0) {
                    currentPlayTimes = Math.floor(-currentTime / duration);
                    currentTime = duration - (-currentTime % duration);
                }
                else {
                    currentPlayTimes = Math.floor(currentTime / duration);
                    currentTime %= duration;
                }

                if (this._playTimes > 0 && currentPlayTimes > this._playTimes) {
                    currentPlayTimes = this._playTimes;
                }
            }

            if (this._currentTime == currentTime) {
                return;
            }

            const cacheFrameIndex = Math.floor(currentTime * this._clipConfig.cacheTimeToFrameScale);
            if (this._cacheFrameIndex != cacheFrameIndex) {
                this._cacheFrameIndex = cacheFrameIndex;

                const displayFrameArray = this._groupConfig.displayFrameArray;
                const transformArray = this._groupConfig.transformArray;
                const colorArray = this._groupConfig.colorArray;

                //
                let isFirst = true;
                let hasDisplay = false;
                let needCacheRectangle = false;
                const prevCacheRectangle = this._cacheRectangle;
                this._cacheRectangle = this._clipConfig.cacheRectangles[this._cacheFrameIndex];
                if (this._batchEnabled && !this._cacheRectangle) {
                    needCacheRectangle = true;
                    this._cacheRectangle = new egret.Rectangle();
                    this._clipConfig.cacheRectangles[this._cacheFrameIndex] = this._cacheRectangle;
                }

                // Update slots.
                for (let i = 0, l = this._slots.length; i < l; ++i) {
                    const slot = this._slots[i];
                    const clipFrameIndex = this._frameSize * this._cacheFrameIndex + i * 2;
                    const displayFrameIndex = this._clipArray[clipFrameIndex] * 2;
                    if (displayFrameIndex >= 0) {
                        const displayIndex = displayFrameArray[displayFrameIndex];
                        const colorIndex = displayFrameArray[displayFrameIndex + 1] * 8;
                        const transformIndex = this._clipArray[clipFrameIndex + 1] * 6;
                        let colorChange = false;

                        if (slot.displayIndex != displayIndex) {
                            slot.displayIndex = displayIndex;
                            colorChange = true;
                            this._updateSlotDisplay(slot);
                        }

                        if (slot.colorIndex != colorIndex || colorChange) {
                            slot.colorIndex = colorIndex;
                            if (slot.colorIndex >= 0) {
                                this._updateSlotColor(
                                    slot,
                                    colorArray[colorIndex] * 0.01,
                                    colorArray[colorIndex + 1] * 0.01,
                                    colorArray[colorIndex + 2] * 0.01,
                                    colorArray[colorIndex + 3] * 0.01,
                                    colorArray[colorIndex + 4],
                                    colorArray[colorIndex + 5],
                                    colorArray[colorIndex + 6],
                                    colorArray[colorIndex + 7]
                                );
                            }
                            else {
                                this._updateSlotColor(slot, 1, 1, 1, 1, 0, 0, 0, 0);
                            }
                        }

                        hasDisplay = true;

                        if (slot.transformIndex != transformIndex) {
                            slot.transformIndex = transformIndex;

                            if (this._batchEnabled) {
                                // RenderNode display.
                                let matrix = (<egret.sys.BitmapNode>slot.display.$renderNode).matrix;
                                if (!matrix) {
                                    matrix = (<egret.sys.BitmapNode>slot.display.$renderNode).matrix = new egret.Matrix();
                                }

                                matrix.a = transformArray[transformIndex];
                                matrix.b = transformArray[transformIndex + 1];
                                matrix.c = transformArray[transformIndex + 2];
                                matrix.d = transformArray[transformIndex + 3];
                                matrix.tx = transformArray[transformIndex + 4];
                                matrix.ty = transformArray[transformIndex + 5];
                            }
                            else {
                                // Classic display.
                                _helpMatrix.a = transformArray[transformIndex];
                                _helpMatrix.b = transformArray[transformIndex + 1];
                                _helpMatrix.c = transformArray[transformIndex + 2];
                                _helpMatrix.d = transformArray[transformIndex + 3];
                                _helpMatrix.tx = transformArray[transformIndex + 4];
                                _helpMatrix.ty = transformArray[transformIndex + 5];

                                slot.display.$setMatrix(_helpMatrix);
                            }
                        }

                        // 
                        if (this._batchEnabled && needCacheRectangle) {
                            // RenderNode display.
                            const matrix = (<egret.sys.BitmapNode>slot.display.$renderNode).matrix;

                            _helpRectangle.x = 0;
                            _helpRectangle.y = 0;
                            _helpRectangle.width = slot.displayConfig.texture.textureWidth;
                            _helpRectangle.height = slot.displayConfig.texture.textureHeight;
                            matrix.$transformBounds(_helpRectangle);

                            if (isFirst) {
                                isFirst = false;
                                this._cacheRectangle.x = _helpRectangle.x;
                                this._cacheRectangle.width = _helpRectangle.x + _helpRectangle.width;
                                this._cacheRectangle.y = _helpRectangle.y;
                                this._cacheRectangle.height = _helpRectangle.y + _helpRectangle.height;
                            }
                            else {
                                this._cacheRectangle.x = Math.min(this._cacheRectangle.x, _helpRectangle.x);
                                this._cacheRectangle.width = Math.max(this._cacheRectangle.width, _helpRectangle.x + _helpRectangle.width);
                                this._cacheRectangle.y = Math.min(this._cacheRectangle.y, _helpRectangle.y);
                                this._cacheRectangle.height = Math.max(this._cacheRectangle.height, _helpRectangle.y + _helpRectangle.height);
                            }
                        }
                    }
                    else if (slot.displayIndex != -1) {
                        slot.displayIndex = -1;
                        this._updateSlotDisplay(slot);
                    }
                }

                //
                if (this._cacheRectangle) {
                    if (hasDisplay && needCacheRectangle && isFirst && prevCacheRectangle) {
                        this._cacheRectangle.x = prevCacheRectangle.x;
                        this._cacheRectangle.y = prevCacheRectangle.y;
                        this._cacheRectangle.width = prevCacheRectangle.width;
                        this._cacheRectangle.height = prevCacheRectangle.height;
                    }

                    this.$invalidateContentBounds();
                }
            }

            if (this._isCompleted) {
                this._isPlaying = false;
            }

            if (!this._isStarted) {
                this._isStarted = true;
                if (this.hasEventListener(MovieEvent.START)) {
                    const event = egret.Event.create(MovieEvent, MovieEvent.START);
                    event.movie = this;
                    event.clipName = this._clipConfig.name;
                    event.name = null;
                    event.slotName = null;
                    this.dispatchEvent(event);
                }
            }

            this._isReversing = this._currentTime > currentTime && this._currentPlayTimes == currentPlayTimes;

            // Action and event.
            const frameCount = this._clipConfig.frame ? this._clipConfig.frame.length : 0;
            if (frameCount > 0) {
                const currentFrameIndex = Math.floor(this._currentTime * this._config.frameRate);
                const currentFrameConfig = this._groupConfig.frame[this._clipConfig.frame[currentFrameIndex]];
                if (this._currentFrameConfig != currentFrameConfig) {
                    if (frameCount > 1) {
                        let crossedFrameConfig = this._currentFrameConfig;
                        this._currentFrameConfig = currentFrameConfig;

                        if (!crossedFrameConfig) {
                            const prevFrameIndex = Math.floor(this._currentTime * this._config.frameRate);
                            crossedFrameConfig = this._groupConfig.frame[this._clipConfig.frame[prevFrameIndex]];

                            if (this._isReversing) {

                            }
                            else {
                                if (
                                    this._currentTime <= crossedFrameConfig.position ||
                                    this._currentPlayTimes != currentPlayTimes
                                ) {
                                    crossedFrameConfig = this._groupConfig.frame[crossedFrameConfig.prev];
                                }
                            }
                        }

                        if (this._isReversing) {
                            while (crossedFrameConfig != currentFrameConfig) {
                                this._onCrossFrame(crossedFrameConfig);
                                crossedFrameConfig = this._groupConfig.frame[crossedFrameConfig.prev];
                            }
                        }
                        else {
                            while (crossedFrameConfig != currentFrameConfig) {
                                crossedFrameConfig = this._groupConfig.frame[crossedFrameConfig.next];
                                this._onCrossFrame(crossedFrameConfig);
                            }
                        }
                    }
                    else {
                        this._currentFrameConfig = currentFrameConfig;
                        if (this._currentFrameConfig) {
                            this._onCrossFrame(this._currentFrameConfig);
                        }
                    }
                }
            }

            this._currentTime = currentTime;

            // Advance child armatre time.
            for (let i = 0, l = this._childMovies.length; i < l; ++i) {
                this._childMovies[i].advanceTime(passedTime);
            }

            if (this._currentPlayTimes != currentPlayTimes) {
                this._currentPlayTimes = currentPlayTimes;
                if (this.hasEventListener(MovieEvent.LOOP_COMPLETE)) {
                    const event = egret.Event.create(MovieEvent, MovieEvent.LOOP_COMPLETE);
                    event.movie = this;
                    event.clipName = this._clipConfig.name;
                    event.name = null;
                    event.slotName = null;
                    this.dispatchEvent(event);
                    egret.Event.release(event);
                }

                if (this._isCompleted && this.hasEventListener(MovieEvent.COMPLETE)) {
                    const event = egret.Event.create(MovieEvent, MovieEvent.COMPLETE);
                    event.movie = this;
                    event.clipName = this._clipConfig.name;
                    event.name = null;
                    event.slotName = null;
                    this.dispatchEvent(event);
                    egret.Event.release(event);
                }
            }

            this._isLockDispose = false;
            if (this._isDelayDispose) {
                this.dispose();
            }
        }
        /**
         * @language zh_CN
         * 播放动画剪辑。
         * @param clipName 动画剪辑的名称，如果未设置，则播放默认动画剪辑，或将暂停状态切换为播放状态，或重新播放上一个正在播放的动画剪辑。 
         * @param playTimes 动画剪辑需要播放的次数。 [-1: 使用动画剪辑默认值, 0: 无限循环播放, [1~N]: 循环播放 N 次]
         * @version DragonBones 4.7
         */
        public play(clipName: string = null, playTimes: number = -1): void {
            if (clipName) {
                let clipConfig = <ClipConfig>null;
                for (let i = 0, l = this._config.clip.length; i < l; ++i) {
                    const data = this._config.clip[i];
                    if (data.name == clipName) {
                        clipConfig = data;
                    }
                }

                if (clipConfig) {
                    this._clipConfig = clipConfig;
                    this._clipArray = new Int16Array(this._groupConfig.arrayBuffer, this._groupConfig.offset + this._groupConfig.position[0] + this._clipConfig.p, this._clipConfig.s / this._groupConfig.position[2]);

                    if (!this._clipConfig.cacheRectangles) {
                        this._clipConfig.cacheRectangles = [];
                    }

                    this._isPlaying = true;
                    this._isStarted = false;
                    this._isCompleted = false;

                    if (playTimes < 0 || playTimes != playTimes) {
                        this._playTimes = this._clipConfig.playTimes;
                    }
                    else {
                        this._playTimes = playTimes;
                    }

                    this._time = 0;
                    this._currentTime = 0;
                    this._currentPlayTimes = 0;
                    this._cacheFrameIndex = -1;
                    this._currentFrameConfig = null;
                    this._cacheRectangle = null;

                    this.clipTimeScale = 1 / this._clipConfig.scale;
                }
                else {
                    console.warn("No clip in movie.", this._config.name, clipName);
                }
            }
            else if (this._clipConfig) {
                if (this._isPlaying || this._isCompleted) {
                    this.play(this._clipConfig.name, this._playTimes);
                }
                else {
                    this._isPlaying = true;
                }
                // playTimes
            }
            else if (this._config.action) {
                this.play(this._config.action, playTimes);
            }
        }
        /**
         * @language zh_CN
         * 暂停播放动画。
         * @version DragonBones 4.7
         */
        public stop(): void {
            this._isPlaying = false;
        }
        /**
         * @language zh_CN
         * 从指定时间播放动画。
         * @param clipName 动画剪辑的名称。 
         * @param time 指定时间。（以秒为单位）
         * @param playTimes 动画剪辑需要播放的次数。 [-1: 使用动画剪辑默认值, 0: 无限循环播放, [1~N]: 循环播放 N 次]
         * @version DragonBones 4.7
         */
        public gotoAndPlay(clipName: string = null, time: number, playTimes: number = -1): void {
            time %= this._clipConfig.duration;
            if (time < 0) {
                time += this._clipConfig.duration;
            }

            this.play(clipName, playTimes);
            this._time = time;
            this._currentTime = time;
        }
        /**
         * @language zh_CN
         * 将动画停止到指定时间。
         * @param clipName 动画剪辑的名称。 
         * @param time 指定时间。（以秒为单位）
         * @version DragonBones 4.7
         */
        public gotoAndStop(clipName: string = null, time: number): void {
            time %= this._clipConfig.duration;
            if (time < 0) {
                time += this._clipConfig.duration;
            }

            this.play(clipName, 1);
            this._time = time;
            this._currentTime = time;

            this.advanceTime(0.001);
            this.stop();
        }
        /**
         * @language zh_CN
         * 由 Movie 自己来更新动画。
         * @param on 开启或关闭 Movie 自己对动画的更新。
         * @version DragonBones 4.7
         */
        public advanceTimeBySelf(on: boolean): void {
            if (on) {
                EgretFactory._clock.add(this);
            }
            else {
                EgretFactory._clock.remove(this);
            }
        }
        /**
         * @language zh_CN
         * 是否包含指定动画剪辑。
         * @param clipName 动画剪辑的名称。
         * @version DragonBones 4.7
         */
        public hasClip(clipName: string): boolean {
            return this._config.clip[clipName] != null;
        }
        /**
         * @language zh_CN
         * 动画剪辑是否处正在播放。
         * @version DragonBones 4.7
         */
        public get isPlaying(): boolean {
            return this._isPlaying && !this._isCompleted;
        }
        /**
         * @language zh_CN
         * 动画剪辑是否均播放完毕。
         * @version DragonBones 4.7
         */
        public get isComplete(): boolean {
            return this._isCompleted;
        }
        /**
         * @language zh_CN
         * 当前动画剪辑的播放时间。 (以秒为单位)
         * @version DragonBones 4.7
         */
        public get currentTime(): number {
            return this._currentTime;
        }
        /**
         * @language zh_CN
         * 当前动画剪辑的总时间。 (以秒为单位)
         * @version DragonBones 4.7
         */
        public get totalTime(): number {
            return this._clipConfig ? this._clipConfig.duration : 0;
        }
        /**
         * @language zh_CN
         * 当前动画剪辑的播放次数。
         * @version DragonBones 4.7
         */
        public get currentPlayTimes(): number {
            return this._currentPlayTimes;
        }
        /**
         * @language zh_CN
         * 当前动画剪辑需要播放的次数。 [0: 无限循环播放, [1~N]: 循环播放 N 次]
         * @version DragonBones 4.7
         */
        public get playTimes(): number {
            return this._playTimes;
        }

        public get groupName(): string {
            return this._groupConfig.name;
        }
        /**
         * @language zh_CN
         * 正在播放的动画剪辑名称。
         * @version DragonBones 4.7
         */
        public get clipName(): string {
            return this._clipConfig ? this._clipConfig.name : null;
        }
        /**
         * @language zh_CN
         * 所有动画剪辑的名称。
         * @version DragonBones 4.7
         */
        public get clipNames(): string[] {
            return this._clipNames;
        }
    }
}