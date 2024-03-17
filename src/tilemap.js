import { MAP_MODE, ROUND_TYPE } from "./const";
import TilemapData from "./tilemap-data";
import { range, round } from "./utils";

const ZERO_VEC2 = { x: 0, y: 0 };

class Tilemap {
  constructor(app, drawable, tilemapName) {
    this.app = app;
    /** @type {TilemapRender} */
    this.render = app.render;

    this.camera = ZERO_VEC2; // 摄像机
    this.offset = ZERO_VEC2; // 坐标偏移
    this.name = tilemapName;
    this.tileStart = ZERO_VEC2; // 瓦片开始绘制的索引
    this.tileSize = ZERO_VEC2; // 瓦片大小
    this.retlTileSize = ZERO_VEC2;
    this.scale = ZERO_VEC2;
    // 绘制几个瓦片
    this.drawTileNum = ZERO_VEC2;

    this.tilesetName = null;
    this.mapData = new TilemapData();
    this.layer = 0;
    this.mode = MAP_MODE.SQUARE;
    this.drawable = drawable;
    this.members = new Set();
    this.show = true;

    this.currentTileset = null;
  }
  get tileset() {
    return this.app.tilesets.get(this.tilesetName);
  }
  calculation() {
    const m4 = this.render.twgl.m4;
    const drawable = this.drawable;
    switch (this.mode) {
      case MAP_MODE.ISOMETRIC:
        this.tileSize.y = Math.round(this.retlTileSize.y / 2);
        break;
      case MAP_MODE.SQUARE:
        this.tileSize.y = this.retlTileSize.y;
        break;
      default:
        throw new Error(`Unknown map mode ${this.mode}`);
    }
    this.tileSize.x = this.retlTileSize.x;
    this.nativeSize = this.app.renderer._nativeSize;
    this.scale = {
      x: drawable._scale[0] / 100,
      y: drawable._scale[1] / 100,
    };
    this.camera = {
      x:
        Math.ceil(drawable._position[0] + this.nativeSize[0] / 2) /
        this.scale.x,
      y:
        Math.ceil(drawable._position[1] - this.nativeSize[1] / 2) /
        this.scale.y,
    };
    this.offset = {
      x: this.camera.x % this.tileSize.x,
      y: this.camera.y % this.tileSize.y,
    };
    this.tileStart = {
      x: -round(this.camera.x / this.tileSize.x, ROUND_TYPE.FLOOR),
      y: round(this.camera.y / this.tileSize.y, ROUND_TYPE.FLOOR),
    };
    this.drawTileNum = {
      x: Math.ceil(this.nativeSize[0] / (this.tileSize.x * this.scale.x)) + 1,
      y: Math.ceil(this.nativeSize[1] / (this.tileSize.y * this.scale.y)) + 1,
    };
    this.haflDrawNum = {
      x: Math.ceil(this.drawTileNum.x / 2),
      y: Math.ceil(this.drawTileNum.y / 2),
    };
    const model = m4.identity();
    m4.translate(
      model,
      [-this.nativeSize[0] / 2, this.nativeSize[1] / 2, 0],
      model
    );
    m4.scale(model, [this.scale.x, this.scale.y, 1], model);
    m4.translate(model, [this.offset.x, this.offset.y, 0], model);
    this.render.setModel(model);
  }
  calculationMembers() {
    const sort = {};
    this.members.forEach((drawable) => {
      if (this.app.renderer._drawList.includes(drawable._id)) {
        const layer = drawable.tilemapData.sort;
        if (!sort[layer]) sort[layer] = [];
        sort[layer].push(drawable);
      } else {
        // 加入tilemap的 drawable 被删除
        this.members.delete(drawable);
      }
    });
    return sort;
  }
  draw() {
    if (!this.show || !this.tileset) return;
    this.currentTileset = this.tileset;
    this.calculation();
    const toRenderMembers = this.calculationMembers();

    const stepOffset = { x: 0, y: 0 };

    stepOffset.y = this.drawTileNum.y * this.tileSize.y;
    for (let y = -this.drawTileNum.y; y < this.drawTileNum.y * 2; y++) {
      this.drawRow(
        y,
        stepOffset,
        toRenderMembers,
        y < 0 || y > this.drawTileNum.y
      );
    }
  }
  // 需要考察中心出屏幕边界的是否在屏幕里面
  drawRow(y, stepOffset, toRenderMembers, beyondRendering) {
    let equOffset = 0;
    if (this.mode == MAP_MODE.ISOMETRIC && y % 2 == 0) {
      equOffset += Math.round(this.tileSize.x / 2);
    }
    stepOffset.x = -this.tileSize.x * this.drawTileNum.x;
    for (let x = -this.drawTileNum.x; x < this.drawTileNum.x * 2; x++) {
      this.drawTile(
        equOffset + stepOffset.x,
        stepOffset.y,
        this.tileStart.x + x,
        this.tileStart.y + y,
        (x < 0 || x > this.drawTileNum.x) && beyondRendering
      );
      stepOffset.x += this.tileSize.x;
    }
    this.render.drawMembers(this.tileStart.y + y, toRenderMembers);
    stepOffset.y -= this.tileSize.y;
  }

  update(opt) {
    this.retlTileSize = {
      x: range(opt.tileSize.x, 0, 1024),
      y: range(opt.tileSize.y, 0, 1024),
    };
    this.layer = range(opt.layer, 0, Infinity);
    this.tilesetName = opt.tilesetName;
    this.mode = opt.mode;
  }
  /**
   * 绘制一个tile
   * @param {Number} offsetX 位置偏移
   * @param {Number} offsetY 位置偏移
   * @param {Number} x 数据索引
   * @param {Number} y 数据索引
   */
  drawTile(offsetX, offsetY, x, y, beyondRendering) {
    const id = this.mapData.getData({ x, y });
    if (!id) return;
    /** @type {TileData} */
    const tileData = this.currentTileset.mapping.get(id);
    if (!tileData) return; // 呗删掉的tileset

    const rof = tileData.isClip ? [0, 0] : tileData.skin._rotationCenter;

    if (beyondRendering) {
      const X = (offsetX - rof[1]) * this.scale.x - tileData.offset.y;
      if (X > this.nativeSize[0]) {
        return;
      }
      if (X + tileData.width < 0) {
        return;
      }
      const Y = (offsetY + rof[1]) * this.scale.y - tileData.offset.y;
      if (Y + tileData.height < -this.nativeSize[1]) {
        return;
      }
      if (Y > 0) {
        return;
      }
    }
    const clip = tileData.clip;
    const texture = tileData.getTexture([
      this.scale.x * clip.width,
      this.scale.y * clip.height,
    ]);

    this.render.addTile(
      texture,
      tileData.width,
      tileData.height,
      clip.x,
      clip.y,
      clip.width,
      clip.height,
      offsetX - rof[0],
      offsetY + rof[1],
      tileData.color,
      tileData.matrix
    );
  }
  destory() {
    const tileData = this.drawable.tilemapData;
    if (tileData) {
      delete tileData.tilemaps[this.name];
    }
  }
  getTileData(pos) {
    if (!this.tileset) return;
    const data = this.mapData.getData(pos);
    if (!data) return;
    return this.tileset.mapping.get(data);
  }
  setTileData(pos, tileName) {
    if (tileName === "0") {
      this.mapData.setData(pos, 0);
      return;
    }
    if (!this.tileset) return;
    const data = this.tileset.nameMapping.get(tileName);
    if (data === undefined) return; // data 可能为 0
    this.mapData.setData(pos, data);
  }
  mapToPos(x, y) {
    const drawable = this.drawable;
    return {
      x: x * (this.retlTileSize.x * this.scale.x) + drawable._position[0],
      y: drawable._position[1] - y * (this.retlTileSize.y * this.scale.y),
    };
  }
  posToMap(x, y) {
    const drawable = this.drawable;
    return {
      x: (x - drawable._position[0]) / (this.retlTileSize.x * this.scale.x),
      y: (drawable._position[1] - y) / (this.retlTileSize.y * this.scale.y),
    };
  }
  clearTileData() {
    this.mapData.clearTileData();
  }
}

export default Tilemap;
