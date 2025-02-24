const { ccclass, property } = cc._decorator;
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface overlapEmpt {
  wood: cc.Node;
  empt: cc.Node;
}

@ccclass
export default class game extends cc.Component {
  slots: cc.Node[] = [];
  woods: cc.Node[] = [];
  nails: cc.Node[] = [];
  thisNail: cc.Node = null;

  allwoods: number = 0; // 记录所有木板数量
  eliminatewoods: number = 0; // 消除的木板数量
  destruction: boolean = false; // 一键销毁
  @property
  isDeBug: boolean = false;

  // @property(cc.Graphics)
  graphics: cc.Graphics = null; // 在编辑器中添加Graphics组件的引用
  onLoad() {
    cc.director.getCollisionManager().enabled = true;
    cc.director.getPhysicsManager().enabled = true;
    //调整重力
    cc.director.getPhysicsManager().gravity = cc.v2(0, -980);
    // cc.director.getCollisionManager().enabledDebugDraw = true;
    // cc.director.getPhysicsManager().debugDrawFlags =
    //   cc.PhysicsManager.DrawBits.e_aabbBit |
    //   cc.PhysicsManager.DrawBits.e_jointBit |
    //   cc.PhysicsManager.DrawBits.e_shapeBit;

    this.initialization();
  }

  //start() {}

  initialization() {
    this.initializationData();
    // 创建一个新的节点用于存放 Graphics 组件
    const graphicsNode = new cc.Node("GraphicsNode");
    this.node.addChild(graphicsNode); // 将节点添加到当前组件的节点下

    // 添加 Graphics 组件
    this.graphics = graphicsNode.addComponent(cc.Graphics);
    this.graphics.lineWidth = 2;
    this.graphics.strokeColor = cc.Color.RED; // 设置包围盒的颜色
  }

  initializationData() {
    this.slots = this.node.getChildByName("slots").children;
    this.woods = this.node.getChildByName("Woods").children;
    this.nails = this.node.getChildByName("Nails").children;
    this.allwoods = this.woods.length;
    this.eliminatewoods = 0;
    this.initialzationEvent();
  }

  initialzationEvent() {
    const setupTouchEvents = (nodes, callback) => {
      if (nodes.length > 0) {
        nodes.forEach((node) => {
          // 使用箭头函数确保 `this` 指向 Game 类实例
          node.on(
            cc.Node.EventType.TOUCH_END,
            () => callback.call(this, node),
            this
          );
        });
      }
    };

    if (this.slots) setupTouchEvents(this.slots, this.slotTouchEnd);
    if (this.nails) setupTouchEvents(this.nails, this.NailTouchEnd);
  }

  //坐标转换
  // convertPosition(node, position, toWorld = true) {
  //   return toWorld
  //     ? node.convertToWorldSpaceAR(position)
  //     : node.convertToNodeSpaceAR(position);
  // }
  //钉子点击
  NailTouchEnd(nail) {
    cc.log("NailTouchEnd:", nail);
    if (this.destruction) {
      this.thisNail = nail;
      this.removejoint();
      this.destruction = false;
      this.thisNail.destroy();
      this.thisNail = null;
      cc.find("gamefunc").getComponent("gamefunc").pullEnd();
      return;
    }
    if (this.thisNail === nail) {
      this.thisNail = null;
      return;
    }
    if (this.thisNail) {
      const screwComponent = this.thisNail.getComponent("screw");
      if (screwComponent.isShowStud) {
        screwComponent.touchfun();
      }
    }
    this.thisNail = nail;
  }
  //槽位点击
  slotTouchEnd(slot) {
    if (!this.thisNail) return;
    const overlapEmpt = this.whetherPutInto(slot);
    if (!overlapEmpt) {
      cc.log(overlapEmpt);
      this.thisNail.getComponent("screw").prohibited();
      return cc.log("不能放入");
    }
    const nail = this.thisNail;
    const SlotPosition = cc.v3(slot.x, slot.y, slot.z);
    this.removejoint();
    cc.tween(nail)
      .call(() => {
        this.thisNail.getComponent(cc.PhysicsCollider).enabled = false;
      })
      .to(0.3, {
        position: SlotPosition,
      })
      .call(() => {
        if (overlapEmpt !== true) this.addJoint(overlapEmpt);
        nail.getComponent("screw").touchfun();
        this.thisNail.getComponent(cc.PhysicsCollider).enabled = true;
        this.thisNail = null;
      })
      .start();
  }
  //卸载相关关节
  removejoint() {
    this.woods.forEach((wood) => {
      const joints = wood.getComponents(cc.RevoluteJoint);
      if (joints.length === 0) {
        return cc.log(wood.name, "无关节");
      }
      joints.forEach((joint) => {
        const connectedBody = joint.connectedBody;
        if (!connectedBody) {
          return cc.log(wood.name, "无连接体");
        }
        if (connectedBody.node === this.thisNail) {
          wood.removeComponent(joint);
        }
      });
    });
  }

  //判断是否能放入钉子

  whetherPutInto(slot: cc.Node): boolean | overlapEmpt[] {
    const slotCollider = slot.getComponent(cc.CircleCollider);
    const slotRect: Rect = {
      x: slot.position.x - slotCollider.radius / 4,
      y: slot.position.y - slotCollider.radius / 4,
      // width: slotCollider.radius * 2,
      // height: slotCollider.radius * 2,
      width: slotCollider.radius / 2,
      height: slotCollider.radius / 2,
    };

    const overlappingWoods: cc.Node[] = [];
    const graphics = this.node.getComponent(cc.Graphics);
    if (this.isDeBug) {
      // 绘制 slotRect
      graphics.clear();
      graphics.strokeColor = cc.Color.GREEN;
      graphics.rect(slotRect.x, slotRect.y, slotRect.width, slotRect.height);
      graphics.stroke();
    }

    this.woods.forEach((wood) => {
      const woodCollider = wood.getComponent(cc.PhysicsBoxCollider);
      const woodSize = woodCollider.size;
      const woodPosition = wood.position;
      const woodRotation = wood.angle;

      const woodRect: Rect = {
        x: woodPosition.x - woodSize.width / 2,
        y: woodPosition.y - woodSize.height / 2,
        width: woodSize.width,
        height: woodSize.height,
      };

      // 获取旋转后的顶点
      const rotatedVertices = this.getRotatedVertices(woodRect, woodRotation);

      // 绘制旋转后的木头矩形
      if (this.isDeBug) {
        graphics.strokeColor = cc.Color.RED;
        graphics.moveTo(rotatedVertices[0].x, rotatedVertices[0].y);
        for (let i = 1; i < rotatedVertices.length; i++) {
          graphics.lineTo(rotatedVertices[i].x, rotatedVertices[i].y);
        }
        graphics.stroke();
      }

      // 使用旋转后的顶点进行重叠检测
      const overlap = this.rectanglesOverlap(
        rotatedVertices,
        this.getRectVertices(slotRect)
      );
      if (overlap) overlappingWoods.push(wood);
    });

    if (overlappingWoods.length > 0) {
      const overlapEmpt = [];
      const overlappingEmptWithWoods = overlappingWoods.filter((wood) => {
        const emptNodes = wood.children.filter((child) =>
          child.name.startsWith("Empt")
        );
        const woods = cc.find("Game/Woods");
        let hasOverlap = false;

        emptNodes.forEach((empt) => {
          const emptCollider = empt.getComponent(cc.CircleCollider);

          // 将 Empt 的位置转换为世界坐标
          const worldPos = wood.convertToWorldSpaceAR(empt.position);
          // 将世界坐标转换回 woods 的坐标
          const emptLocalPos = woods.convertToNodeSpaceAR(worldPos);

          const emptRect = {
            x: emptLocalPos.x - emptCollider.radius / 2,
            y: emptLocalPos.y - emptCollider.radius / 2,
            width: emptCollider.radius / 2,
            height: emptCollider.radius / 2,
          };

          // 判断重叠
          const overlap = this.rectanglesOverlap(
            this.getRectVertices(slotRect),
            this.getRectVertices(emptRect)
          );

          if (overlap) {
            hasOverlap = true;
            const bbb = { wood: wood, empt: empt };
            overlapEmpt.push(bbb);
          }
        });

        return hasOverlap; // 保留重叠的木头
      });

      const remaining = overlappingWoods.filter((wood) => {
        return !overlapEmpt.some((empt) => {
          return empt.wood == wood;
        });
      });
      cc.log("remaining", remaining);

      if (remaining.length == 0) {
        return overlapEmpt;
      } else return false;
    }

    return true;
  }

  //中枢函数
  rectanglesOverlap(
    verticesA: { x: number; y: number }[],
    verticesB: { x: number; y: number }[]
  ): boolean {
    for (const vertex of verticesA) {
      if (this.pointInPolygon(vertex, verticesB)) {
        return true; // 有重叠
      }
    }
    for (const vertex of verticesB) {
      if (this.pointInPolygon(vertex, verticesA)) {
        return true; // 有重叠
      }
    }
    return false; // 没有重叠
  }
  // 计算旋转顶点
  getRotatedVertices(rect: Rect, rotation: number): { x: number; y: number }[] {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    const halfWidth = rect.width / 2;
    const halfHeight = rect.height / 2;

    const angle = cc.misc.degreesToRadians(rotation);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return [
      {
        x: centerX + (-halfWidth * cos - -halfHeight * sin),
        y: centerY + (-halfWidth * sin + -halfHeight * cos),
      },
      {
        x: centerX + (halfWidth * cos - -halfHeight * sin),
        y: centerY + (halfWidth * sin + -halfHeight * cos),
      },
      {
        x: centerX + (halfWidth * cos - halfHeight * sin),
        y: centerY + (halfWidth * sin + halfHeight * cos),
      },
      {
        x: centerX + (-halfWidth * cos - halfHeight * sin),
        y: centerY + (-halfWidth * sin + halfHeight * cos),
      },
    ];
  }

  pointInPolygon(
    point: { x: number; y: number },
    vertices: { x: number; y: number }[]
  ): boolean {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x,
        yi = vertices[i].y;
      const xj = vertices[j].x,
        yj = vertices[j].y;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
  // 投影轴
  getAxes(vertices: { x: number; y: number }[]): { x: number; y: number }[] {
    const axes = [];
    for (let i = 0; i < vertices.length; i++) {
      const next = (i + 1) % vertices.length;
      const edge = {
        x: vertices[next].x - vertices[i].x,
        y: vertices[next].y - vertices[i].y,
      };
      axes.push({ x: -edge.y, y: edge.x }); // 向量
    }
    return axes;
  }

  // 投影轴
  projectOntoAxis(
    vertices: { x: number; y: number }[],
    axis: { x: number; y: number }
  ): [number, number] {
    let min = Infinity;
    let max = -Infinity;

    for (const vertex of vertices) {
      const projection = vertex.x * axis.x + vertex.y * axis.y;
      min = Math.min(min, projection);
      max = Math.max(max, projection);
    }

    return [min, max];
  }
  //顶点
  getRectVertices(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): { x: number; y: number }[] {
    return [
      { x: rect.x, y: rect.y }, // 左下角
      { x: rect.x + rect.width, y: rect.y }, // 右下角
      { x: rect.x + rect.width, y: rect.y + rect.height }, // 右上角
      { x: rect.x, y: rect.y + rect.height }, // 左上角
    ];
  }
  //是否重叠
  pointInRect(point: { x: number; y: number }, rect: Rect): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  // 添加关节
  addJoint(overlapEmpt: overlapEmpt[]) {
    cc.log("addJoint", overlapEmpt);

    // 获取 Graphics 组件用于绘制
    const graphics = this.node.getComponent(cc.Graphics);
    if (!graphics) {
      cc.error("Graphics 组件未找到！");
      return;
    }

    overlapEmpt.forEach((combination) => {
      // 为每个 wood 添加 RevoluteJoint 组件
      const newJoint = combination.wood.addComponent(cc.RevoluteJoint);

      // 获取 this.thisNail 节点的 RigidBody 组件
      const nailRigidBody = this.thisNail.getComponent(cc.RigidBody);

      if (nailRigidBody) {
        // 确认 this.thisNail 有 RigidBody 组件后再赋值 connectedBody
        newJoint.connectedBody = nailRigidBody;

        // 设置锚点
        newJoint.anchor.x = combination.empt.x;

        // 获取 connectedBody 和 wood 的世界坐标
        const woodWorldPos = combination.wood.convertToWorldSpaceAR(
          cc.v2(0, 0)
        );
        const nailWorldPos = this.thisNail.convertToWorldSpaceAR(cc.v2(0, 0));

        if (this.isDeBug) {
          // 绘制连接线
          // 清除上一次绘制的内容
          //graphics.clear();
          graphics.strokeColor = cc.Color.BLACK;
          graphics.moveTo(nailWorldPos.x, nailWorldPos.y);
          graphics.lineTo(woodWorldPos.x, woodWorldPos.y);
          graphics.stroke();
          // 可选：绘制锚点
          graphics.fillColor = cc.Color.RED;
          graphics.circle(nailWorldPos.x, nailWorldPos.y, 5);
          graphics.fill();

          graphics.fillColor = cc.Color.BLUE;
          graphics.circle(woodWorldPos.x, woodWorldPos.y, 5);
          graphics.fill();
        }
      } else {
        cc.error("this.thisNail 没有 cc.RigidBody 组件");
      }

      cc.log("RevoluteJoint 连接的 Body:", newJoint.connectedBody);
    });
  }
  checkWoodsOutOfScreen() {
    //判断木板数
    const visibleSize = cc.view.getVisibleSize();
    const visibleOrigin = cc.view.getVisibleOrigin();

    // 遍历所有木板
    for (let i = this.woods.length - 1; i >= 0; i--) {
      const wood = this.woods[i];
      const woodWorldPosition = wood.convertToWorldSpaceAR(cc.Vec2.ZERO); //转换坐标

      // 检查木板是否完全掉出屏幕
      if (woodWorldPosition.y < visibleOrigin.y - visibleSize.height / 2) {
        this.woods.splice(i, 0); // 从数组中移除该木板
        wood.destroy(); // 销毁该木板节点
        this.eliminatewoods++;
        cc.log("eliminatewoods:", this.eliminatewoods);
      }
    }
  }

  update(dt) {
    this.checkWoodsOutOfScreen();
  }
}
