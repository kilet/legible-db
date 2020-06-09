const Db = require("./Db")

// 
console.log("case a1:", Db.table('tbl_a').select())
console.log("case a2:", Db.table('tbl_a').select('id,a,b'))

console.log("case a3:", Db.table('tbl_a')
    .field('id,a,b')
    .select()
)
// json形式条件，缺省操作符为‘=’
console.log("case a4:", Db.table('tbl_a')
    .field('id,a,b')
    .where({ id: 1 })
    .select()
)
// 字符串形式条件
console.log("case a5:", Db.table('tbl_a')
    .field('id,a,b')
    .where('id=1')
    .select()
)
// key,op,value 形式条件,操作符为[=,>,<,>=,<=,like,not like,in,not in]等mysql合法操作符
console.log("case a6:", Db.table('tbl_a')
    .field('id,a,b')
    .where('id', '=', 1)
    .select()
)
// json形式条件，自定义操作符，json多个字段共用一个操作符
console.log("case a4:", Db.table('tbl_a').field('id,a,b').where({ id: 'a' }, 'like').select())
// key op value 形式条件，缺省操作符‘=’ 可缺省
console.log("case a7:", Db.table('tbl_a').field('id,a,b').where('id', 1).select())

// and 多条件
console.log("case a8:", Db.table('tbl_a').field('id,a,b').where({ id: 1, a: 2 }).select())
console.log("case a9:", Db.table('tbl_a').field('id,a,b').where('id=1 and a=2').select())
// 多where形式
console.log("case a11:", Db.table('tbl_a')
    .field('id,a,b')
    .where({ id: 1 })
    .where({ a: 2 })
    .where('b=3')
    .where('c','not like',3)
    .select()
)

// or
console.log("case a12:", Db.table('tbl_a').field('id,a,b').where({ id: 1, a: 2 }, 'or').select())
console.log("case a13:", Db.table('tbl_a').field('id,a,b').where('id=1 or a=2').select())

// and 配合or
console.log("case a14:", Db.table('tbl_a').field('id,a,b').where({ id: 1, a: 2 }).whereOr({ b: 2 }).select())
console.log("case a15:", Db.table('tbl_a').where({ id: [1, 2, 3] }, 'NOT IN').select())


//更新方式，
console.log("case b1:", Db.table('tbl_a').update({ id: 1, a: 11, b: 22 }))//不设置where 则id作为条件，下同
console.log("case b2:", Db.table('tbl_a').where({ id: 1 }).update({ a: 11, b: 22 }))

console.log("case b3:", Db.table('tbl_a').data({ a: 11, b: 22 }).where({ id: 1 }).update())
console.log("case b4:", Db.table('tbl_a').data({ a: 11, b: 22 }).where({ id: 1 }).update())
// 增量更新
console.log("case b5:", Db.table('tbl_a').inc({ a: 1, b: 2 }).where({ id: 1 }).update())
console.log("case b6:", Db.table('tbl_a').inc({ a: 1, b: 2 }).data({ c: 3 }).where({ id: 1 }).update())

// 插入
console.log("case c1:", Db.table('tbl_a').insert({ a: 1, b: 2 }))

// 删除
console.log("case d1:", Db.table('tbl_a').delete({ id: 1 }))
console.log("case d2:", Db.table('tbl_a').where({ id: 1 }).delete())

//连表
console.log("case e1:", Db.table('tbl_a a').join('tbl_b b', 'a.id=b.idx').select())
console.log("case e2:", Db.table('tbl_a a').leftJoin('tbl_b b', 'a.id=b.idx').select())
console.log("case e3:", Db.table('tbl_a a').rightJoin('tbl_b b', 'a.id=b.idx').select())

// 子查询
console.log("case f1:", Db.table('tbl_a').where({ id: Db.table('sub').select(false) }, 'NOT IN').select())
console.log("case f2:", Db.table(Db.table('sub').where('id > 0').toSubQuery('sa')).where('id > 10').select())
console.log("case f3:", Db.table(Db.table('sub').where('id > 0').select(), 'sa').where('id > 10').select())

// 统计
console.log('case h1', Db.table('tbl_a').count('id'))
console.log('case h2', Db.table('tbl_a').max('id'))
console.log('case h3', Db.table('tbl_a').min('id'))
console.log('case h4', Db.table('tbl_a').avg('id'))

console.log(Db.table('tbl_a')
   .field('id,a,b')
   .where({ id: 1 })
   .where('b=3')
   .where('c','not like','x')
   .where({d:[5,6,7]},'not in')
   .group('a')
   .page(0,10)
   .order('id')
   .select())

console.log(Db.table('tbl_t2')
   .whereTime('createTime','today')
   .select())

console.log(Db.table('tbl_t3')
   .whereTime('createTime','yesterday')
   .select())

console.log(Db.table('tbl_t4')
   .whereTime('createTime','tomorrow')
   .select())
console.log(Db.table('tbl_t5')
   .whereTime('createTime','week','')
   .select())

console.log(Db.table('tbl_t6')
   .whereTime('createTime','month')
   .select())

console.log(Db.table('tbl_t7')
   .whereTime('createTime','quarter')
   .select())

console.log(Db.table('tbl_t7')
   .whereTime('createTime','year')
   .select())

console.log(Db.table('tbl_t8')
   .whereTime('createTime',1591681442)
   .select())

console.log(Db.table('tbl_t9')
   .whereTime('createTime',1591681442,1551681442)
   .select())

console.log(Db.table('tbl_t10')
   .whereTime('createTime',20200609)
   .select())

console.log("1.若不执行init初始化操作，上述函数可以作为mysql常用语句生成器在任意js语境下使用\n2.配合egg，执行Db.init(app,'dbname') 以设置默认数据库，则select()参数为false时返回生成的语句，否则执行数据库查询操作")


