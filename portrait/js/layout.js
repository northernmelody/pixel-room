import { ITEM_META } from './art/index.js';

const item = (id, art, room, x, y, note, extra={}) => Object.freeze({ id, art, room, x, y, label: ITEM_META[art].label, note, ...extra });

// Each source drawing is an independent object. No room-sized image layer.
export const ITEMS = Object.freeze([
  item('bedroom.rug','bedroomRug','bedroom',53,150,'保留原版编织纹理的卧室地毯。'),
  item('workspace.rug','workspaceRug','workspace',39,248,'保留原版纹理的工作区地毯。'),
  item('kitchen.fan','kitchenFan','kitchen',96,308,'原版厨房夏季小风扇的静态叶片。',{season:'summer'}),
  item('bedroom.window','window-bedroom','bedroom',99,83,'卧室的窗。保留原有窗帘、窗框与窗台，冬天会结一层薄霜。'),
  item('bedroom.wardrobe','wardrobe','bedroom',19,104,'熟悉的衣柜。晚间休闲时点击可以换一身衣服。',{action:'wardrobe'}),
  item('bedroom.bed','bed','bedroom',53,120,'床、枕头、被子，以及床上的腊肠狗抱枕。抱枕和屋里的小狗是两个不同的小伙伴。',{action:'name',tip:'腊肠狗抱枕'}),
  item('bedroom.nightstand','nightstand','bedroom',94,121,'床头柜与夜灯。点击灯的位置，可以开关这盏灯。',{lampIndex:5}),
  item('bedroom.guitar','guitar','bedroom',113,130,'三首原创歌曲的木吉他。点击可以取琴弹唱，睡觉和通话时不行。',{action:'guitar'}),
  item('bedroom.clock','wallClock','bedroom',132,91,'原来的墙钟，也搬进了楼上的卧室。'),
  item('bedroom.boba','plush-boba','bedroom',49,86,'珍珠奶茶玩偶，卧室墙上的六位小伙伴之一。',{action:'name',tip:'奶茶玩偶'}),
  item('bedroom.avocado','plush-avocado','bedroom',65,86,'牛油果玩偶，保留原来的绿色像素。',{action:'name',tip:'牛油果玩偶'}),
  item('bedroom.bunny','plush-bunny','bedroom',81,86,'小兔玩偶，长长的耳朵。',{action:'name',tip:'小兔玩偶'}),
  item('bedroom.melon','plush-melon','bedroom',45,102,'切成月牙的哈密瓜挂件，切面上有一张小脸。点击看看它叫什么。',{action:'name',tip:'MOMO的黄瓜'}),
  item('bedroom.octopus','plush-octopus','bedroom',65,102,'小章鱼玩偶，住在第二排。',{action:'name',tip:'小章鱼玩偶'}),
  item('bedroom.ramen','plush-ramen','bedroom',81,102,'拉面玩偶，六个墙面玩偶全部保留。',{action:'name',tip:'拉面玩偶'}),
  item('bedroom.ac','ac','bedroom',19,74,'夏季的空调。原本的季节物件，随夏季预览出现。',{season:'summer'}),
  item('bedroom.heater','heater','bedroom',128,141,'冬季的暖气片，让卧室添一点暖意。',{season:'winter'}),

  item('workspace.window','window-workspace','workspace',67,171,'工作区独立的一扇窗。四个房间依然各有自己的窗。'),
  item('workspace.bookshelf','bookshelf','workspace',15,201,'书架里保留了两本信件书：给 MOMO 的信，以及 MOMO 的回信。',{content:'letters',action:'letters'}),
  item('workspace.poster','giraffePoster','workspace',44,179,'原来的长颈鹿相框，仍在电脑附近。'),
  item('workspace.socket','socket','workspace',86,212,'插座与线缆，属于工作区的原有细节。'),
  item('workspace.desk','desk','workspace',39,203,'电脑、键盘、咖啡杯和台灯。点击电脑可以查看六个频道。',{lampIndex:4,action:'computer'}),
  item('workspace.chair','chair','workspace',80,235,'电脑旁的椅子，保留原来的像素造型。'),
  item('workspace.fan','fan','workspace',18,178,'夏季的风扇，叶片轻轻转动。',{season:'summer'}),
  item('workspace.humidifier','humidifier','workspace',90,231,'冬季的加湿器，往空气里添一点湿润。',{season:'winter'}),

  item('bathroom.window','window-bathroom','bathroom',143,165,'卫生间的小窗，冬季同样保留窗霜。'),
  item('bathroom.shower','shower','bathroom',107,178,'原有淋浴间与花洒。预留了完整的站立和淋浴空间。'),
  item('bathroom.towel','towel','bathroom',132,180,'毛巾与毛巾架。'),
  item('bathroom.mirror','roundMirror','bathroom',133,197,'原来的圆镜与镜面反光。'),
  item('bathroom.vanity','vanity','bathroom',133,217,'早晨洗手、刷牙的洗手台。'),
  item('bathroom.toilet','toilet','bathroom',154,214,'马桶保留在卫生间右侧，不用作跨房间的通路。'),

  item('kitchen.window','window-kitchen','kitchen',107,272,'厨房的窗，照着餐桌和灶台。'),
  item('kitchen.door','exteriorDoor','kitchen',144,273,'通往庭院的木门。天气合适的傍晚，小人会自己出去荡秋千。',{action:'door'}),
  item('kitchen.fridge','fridge','kitchen',16,302,'取食材、零食和饮水的冰箱。点击可以打开看看里面有什么。',{action:'fridge'}),
  item('kitchen.cabinets','kitchenCabinets','kitchen',49,274,'厨房吊柜，猫咪也喜欢探索这里的高处。',{action:'meal'}),
  item('kitchen.potRack','potRack','kitchen',20,276,'原有的锅、锅铲和挂钩。'),
  item('kitchen.spiceShelf','spiceShelf','kitchen',19,291,'置物架与调料罐。'),
  item('kitchen.counter','kitchenCounter','kitchen',48,310,'操作台、灶台与水槽，小人在这里准备三餐。',{action:'meal'}),
  item('kitchen.plant','kitchenPlant','kitchen',92,294,'厨房的小盆栽，四季的叶色略有不同。'),
  item('kitchen.table','tableStools','kitchen',90,322,'餐桌和两张凳子。三餐与零食会在这里继续。',{action:'meal'}),
  item('kitchen.kettle','kettle','kitchen',108,316,'冬季餐桌上的保温壶。',{season:'winter'}),
  item('kitchen.package','package','kitchen',133,321,'门边的一件快递。跨日可能到达，拆开后的小物会留在屋里。'),
  item('kitchen.dogBed','dogBed','kitchen',121,341,'腊肠狗的小窝，安置在厨房与门区之间。'),

  item('collectible.figurine','collectible-figurine','workspace',27,196,'快递收藏：工作区书架上的金色小雕像。',{collectible:true}),
  item('collectible.mug','collectible-mug','kitchen',76,307,'快递收藏：厨房台面的彩杯。',{collectible:true}),
  item('collectible.painting','collectible-painting','bedroom',153,92,'快递收藏：卧室的小挂画。',{collectible:true}),
  item('collectible.plant','collectible-plant','workspace',73,196,'快递收藏：电脑桌的小盆栽。',{collectible:true}),
  item('collectible.vase','collectible-vase','bathroom',150,211,'快递收藏：洗手台的小花瓶。',{collectible:true}),

  // Actor placements are nominal: their runtime positions come from the navigation controller.
  // The y values keep the (taller) union sprite boxes inside the room bounds.
  item('actor.human','human','bedroom',146,102,'小屋的主人，按北京时间过着自己的生活。'),
  item('actor.cat','cat','bedroom',17,87,'在三层小屋里自主活动的橘猫。'),
  item('actor.dog','dog','kitchen',118,329,'棕色腊肠狗，喜欢散步、吃饭和跟在主人身边。'),
  item('kitchen.dogBowl','dogBowl','kitchen',112,340,'狗粮碗。吃完会减少，第二天重新补满。'),
  item('kitchen.catBowl','catBowl','kitchen',135,340,'猫粮碗。与狗粮碗分别保留。')
]);

export const LAMPS = Object.freeze([
  { id:'lamp.bedroom',type:'lamp',kind:'ceiling',index:0,room:'bedroom',label:'卧室顶灯',x:89,y:77 },
  { id:'lamp.workspace',type:'lamp',kind:'ceiling',index:1,room:'workspace',label:'工作区顶灯',x:49,y:173 },
  { id:'lamp.bathroom',type:'lamp',kind:'ceiling',index:2,room:'bathroom',label:'卫生间顶灯',x:119,y:173 },
  { id:'lamp.kitchen',type:'lamp',kind:'ceiling',index:3,room:'kitchen',label:'厨房顶灯',x:78,y:272 },
  { id:'lamp.desk',type:'lamp',kind:'local',index:4,room:'workspace',label:'工作区台灯',x:76,y:216 },
  { id:'lamp.nightstand',type:'lamp',kind:'local',index:5,room:'bedroom',label:'卧室床头灯',x:100,y:125 }
]);

export const ANCHORS = Object.freeze([
  ['bed.sleep','bedroom',67,150],['bed.sit','bedroom',83,150],['wardrobe.change','bedroom',40,150],
  ['guitar.pick','bedroom',111,150],['window.look','bedroom',134,150],['desk.work','workspace',85,248],
  ['TOP_LEISURE_LEFT','bedroom',106,150],['TOP_LEISURE_RIGHT','bedroom',124,150],
  ['TV_SEAT_LEFT','bedroom',108,150],['TV_SEAT_RIGHT','bedroom',126,150],
  ['FIREPLACE_SEAT_LEFT','bedroom',126,150],['FIREPLACE_SEAT_RIGHT','bedroom',145,150],
  ['TOP_COFFEE_TABLE','bedroom',116,150],
  ['BED_LEFT','bedroom',60,150],['BED_RIGHT','bedroom',79,150],
  ['BED_EDGE_LEFT','bedroom',58,150],['BED_EDGE_RIGHT','bedroom',84,150],
  ['BED_PILLOW_LEFT','bedroom',58,150],['BED_PILLOW_RIGHT','bedroom',79,150],['BED_CENTER','bedroom',69,150],
  ['exercise','workspace',38,248],['cat.play','workspace',46,248],['toilet.use','bathroom',160,248],
  ['sink.wash','bathroom',145,248],['shower.use','bathroom',118,248],['fridge.take','kitchen',37,346],
  ['stove.cook','kitchen',65,346],['table.eat','kitchen',103,346],['dog.sleep','kitchen',128,346],
  ['dog.food','kitchen',115,346],['cat.food','kitchen',138,346]
].map(([id,room,x,y])=>Object.freeze({id,room,x,y})));

export function getVisibleItems(state,world=null){return ITEMS.filter(item=>(!item.season||item.season===state.season)&&(!item.collectible||state.showCollectibles||world?.collectibles?.includes(item.id.split('.').pop())));}
