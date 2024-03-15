
const MAX_TILE_SET = 1024

export class TileData {
    constructor(skin, clip, color, matrix) {
        const size = skin.size
        this.clip = {
            x: (clip.x || 0) / size[0],
            y: (clip.y || 0) / size[1],
            width: (clip.width || 0) / size[0],
            height: (clip.height || 0) / size[1]
        }
        this.tilemapRender = null
        this.tileName = null
        this.width = clip.width
        this.height = clip.height
        this.color = 0xFFFFFFFF // Unit32 color TODO:a
        this.skin = skin
        this.matrix = matrix
    }
    enable(tileName, tilemapRender) {
        this.tileName = tileName
        this.tilemapRender = tilemapRender
    }
    getTexture(size) {
        const skin = this.skin
        if (!skin) {
            return
        }
        return this.tilemapRender.getTexture(this.skin, size)
    }
}

export class TileSet {
    constructor(tilemapRender) {
        this._tilemapRender = tilemapRender
        this._tileDatas = new Map()
        // id => tileData
        this.mapping = new Map()
        // name => id
        this.nameMapping = new Map()

        this.count = 0
    }
    addTileData(tileName, tileData) {
        if (this._tileDatas.size >= MAX_TILE_SET) {
            return
        }

        tileData.enable(tileName, this._tilemapRender)
        let id = 0
        if (this.nameMapping.has(tileName)) {   
            id = this.nameMapping.get(tileData)
        } else {
            this.count += 1 // 使用 Unit16 存储，无法有负数，用0代表空，所以在开始之前count++
            id = this.count
        }
        this.mapping.set(id, tileData)
        this.nameMapping.set(tileName, id)
        this._tileDatas.set(tileName, tileData)

        // if (!this.nameMapping.has(tileName)) {
        //     this.count += 1 // 使用 Unit16 存储，无法有负数，用0代表空，所以在开始之前count++
        // }
        // tileData.enable(tileName, this._tilemapRender)
        // this.mapping.set(this.count, tileData)
        // this.nameMapping.set(tileName, this.count)
        // this._tileDatas.set(tileName, tileData)

    }
    removeTileData(tileName) {
        debugger
        this.mapping.delete(this.nameMapping.get(tileName))
        this.nameMapping.delete(tileName)
        this._tileDatas.delete(tileName)
    }
    getTileData(tileName) {
        return this._tileDatas.get(tileName)
    }

    toJson() {
        const json = []
        this._tileDatas.forEach((_, k) => {
            json.push(k)
        })
        return json
    }
}

export default TileSet