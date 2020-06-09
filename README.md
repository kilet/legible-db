# legible-db
基于egg-mysql 易用的链式数据库查询语句,因为egg原生的mysql使用上有很多不方便，受thinkphp链式数据库查询方式影响，因此做了类似封装。 在网上也找到另一个做了类似封装的，感觉使用起来没那么好用（地址如下）：

 https://github.com/AspenLuoQiang/hyoga-mysql/



所以还是自己写了一套，有些不常用的暂时没做封装，有待完善。有需要的小伙伴欢迎联系qq:464223078

github地址：

https://github.com/kilet/legible-db/

1.函数可以作为mysql常用语句生成器在任意js语境下使用 // 例如 

let result = Db.table('tbl_a') 

.field('id,a,b') 

.where({ id: 1 })

.where('b=3')

.where('c','not like','x')

.where({d:[5,6,7]},'not in')

.group('a') 

.page(0,10) 

.order('id') 

.select()

生成语句：SELECT id,a,b FROM tbl_a where id=1 AND b=3 AND c not like '%x%' AND d not in (5,6,7) group by a order by id limit 0,10

更多详情 请参考test.js 运行测试代码：node test.js

2.在egg框架中使用最佳 需要初始化设置默认数据库：

安装：npm install legible-db

在app.js 调用：

Db.init const Db = require('legible-db'); 

module.exports = app => {

     // 其他代码... 

     Db.init(app,'your dbname');

     // 其他代码... 

}; 

设置后， 

执行 Db.table('tbl_a').select(false) 返回生成的字符串 

执行 await Db.table('tbl_a').select() 返回查询的数据 

update,insert,delte类似

封装常用时间条件：
whereTime()
参数
key：数据库表字段名
tm1：（1）可以是特殊字符串时【tm2：表示偏移量，缺省为0】，可以为'today'，'yesterday','tomorrow','week','month','year','lastWeek','lastMonth','lastYear'
	 （2）可以是YYYY-MM-DD 的时间格式
	 （3）可以是时间戳值，【tm2：若tm2有值表示两个时间戳所指定的日期之间】
