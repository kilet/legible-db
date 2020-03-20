'use strict';
//用于生成sql 语句
class Db {
    // mysql
    constructor(name,db){
        this.tablename = name;
        this.condition = "";
        this.columns = "";
        this.limitStr = "";
        this.orderStr = "";
        this.groupStr = "";
        this.dataString = "";
        this.isPrintLog = true;
        if(typeof db == 'string') {
            this.db = Db.app.mysql.get(db);
        }else if(db){
            this.db = db
        }else{
            this.db = Db.maindb;
        }
        if(Db.app){
            this.logError = Db.app.logger.error.bind(Db.app.logger);
            this.isPrintLog = Db.app.config.env !== "prod"
        }else{
            this.isPrintLog = true;
            this.logError = console.log;
        }
    }
    //在 app.js 调用，进行类初始化
    static init(app,dbname){
        Db.app = app;
        Db.maindb = null;
        if (app.mysql) {
            Db.maindb = app.mysql.get(dbname);
        }
    }
    //生成链式sql语句
    static table(name,db){
        if(typeof name =="string"){
            if(name.indexOf('SELECT') == 0){
                // 子查询情况
                name = '(' + name +') as ' + (db?db:'sub');
                db = null;
                return new Db(name);
            }else{
                return new Db(name,db);
            }
        }else{
            //sub string;
            return new Db( name.toSubQuery(),db);
        }
    }

    static getLastSql(){
        return Db.lastSqlString;
    }

    toSubQuery(alias){
        const sub = '(' + this.select(false) + ')'
        return sub + (alias?' as '+alias:'');
    }
    _whereBuild(conds,op,interLink,outLink){
        if(!conds)return this;
        if(typeof conds == "string"){
            // this.condList.push({cond:conds});
            if(this.condition){
                this.condition += outLink;
            }
            if(op){
                // 支持 where('key','=',value)形式
                if(conds.indexOf('.') == -1 && conds.indexOf('(') == -1){
                    //只替换第一个单词
                    conds = conds.replace(/(\w+)/,'`$1`');
                }
                //不是 （ 开头，需要加上（）
                if(conds.indexOf('(') < 2 && conds.toLowerCase().indexOf(' or ') > 0 ){
                    conds = '('+ conds +')';
                }
                this.condition += conds;

                if(interLink !== undefined) {
                    op = ' ' + op.toLowerCase() + ' ';
                    if(op.indexOf('like') >= 0){
                        this.condition += op + "'%"+ interLink + "%'";
                    }else if(op.indexOf('between') >= 0){
                        this.condition += op + interLink[0] + ' AND ' + interLink[1];
                    }else if(op.indexOf('in') >= 0){
                        if(typeof interLink == 'string'){
                            this.condition += op + interLink;
                        }else{
                            this.condition += op + interLink.join(',')
                        }
                    }else{
                        this.condition += op + interLink;
                    }
                }else{
                    //允许缺省 '=', 其他操作符不能缺省
                    this.condition += '=' + op ;
                }
            }else{
                this.condition += conds;
            }
        }else if(conds){
            //支持js对象，暂不支持数组
            interLink = interLink || ' AND ';
            if(this.condition){
                this.condition += outLink;
            }
            let keys = Object.keys(conds);
            if(keys.length > 1){
                this.condition += " ("
            }

            op = op?op.toLowerCase():'';
            for(let i = 0;i < keys.length;i++){
                let val = conds[keys[i]];
                this.condition += "`"+keys[i] +"`";

                if(op.indexOf('between') >= 0 ){
                    if(val.length == 2){
                        this.condition += ' ' + op + ' ' + val[0] + ' AND ' + val[1];
                    }else{
                        Db.app.logger.info("error: type of 'between must be array of length = 2");
                    }
                }
                else if(op.indexOf('in') >= 0 || Array.isArray(val)){
                    this.condition += ' ' + op + " (";
                    if(typeof val == 'string'){
                        this.condition += val;
                    }else{
                        console.log('val.concat(',')',val.join(','))
                        this.condition += val.join(',')
                    }
                    this.condition += ')';

                }else if(op.indexOf('like') >= 0){
                    this.condition += " LIKE '%" + val + "%'"
                }else{
                    this.condition += (op || '=');
                    if(typeof conds[keys[i]] == "number"){
                        this.condition += conds[keys[i]];
                    }else{
                        this.condition += "'" + conds[keys[i]] + "'";
                    }
                }

                if(i < keys.length -1){
                    this.condition += interLink;
                }
            }

            if(keys.length > 1){
                this.condition += " )"
            }
        }
        return this;
    }
    _joinByType(type,table,on){
        if(table){
            this.tablename += type +' JOIN ' + table +' ';
        }
        if(on){
            this.tablename += ' ON '+ on;
        }
        return this;
    }
    disableLog(){
        this.isPrintLog = false;
        return this;
    }
    rightJoin(table,on){
        return this._joinByType(' RIGHT',table,on);
    }
    leftJoin(table,on){
        return this._joinByType(' LEFT',table,on);
    }
    join(table,on){
        return this._joinByType('',table,on);
    }
    whereOr(conds,op,interLink){
        if(op == "or" || op == "OR"){
            interLink = " OR ";
            op = "=";
        }
        return this._whereBuild(conds,op,interLink,' OR ');
    }
    //where 使用方式说明,与thinkcmf 类似，不支持数组
    //方式1：原生字符串如 where("key1=value1"),where("key1=value1 or key2=value2")
    //方式2：json对象如 where({key1:value1,key2:value2},op);op 可填：'or'表示内部使用或方式连接
    //方式3：单个设置如 where(key,op,value)
    where(conds,op,interLink){
        if(op == "or" || op == "OR"){
            interLink = " OR ";
            op = null;
        }

        return this._whereBuild(conds,op,interLink,' AND ');
    }
    field(columns){
        this.sqlString = '';
        if(typeof columns == "string"){
            this.columns = columns;
        }else if(columns){
            for(let i = 0;i < columns.length;i++){
                if(this.columns){
                    this.columns += ","+ columns[i];
                }else{
                    this.columns += columns[i];
                }
            }
        }
        return this;
    }
    order(key,way){
        //string only
        if(way){
            this.orderStr = "`"+key+"` " + way;
        }else {
            this.orderStr = key ||'';
        }
        return this;
    }
    limit(num){
        if(num){
            this.limitStr = num;
        }
        return this;
    }
    page(page,size){
        page = page ||0;
        size = size || 20;
        this.limitStr = (page*size) + ','+ size;
        return this;
    }
    group(key){
        this.groupStr = key ||"";
        return this;
    }
    _fieldAddDot(fields){
        fields = fields || this.columns || '';
        if(fields){
            let list = null;
            if(typeof fields == 'string'){
                list = fields.split(',');
            }else if(fields){
                list = fields;
            }
            fields ="";
            for (let i=0; i< list.length;i++){
                if(list[i].indexOf(' as ') == -1 && list[i].indexOf('.') == -1){
                    list[i] = list[i].replace(/\s+/g,"");
                    fields += "`" + list[i] + "`";
                    if(list[i].indexOf('(') > 0){
                        fields +=  list[i].replace('(',"(`").replace(')',"`)");
                    }
                }else{
                    fields += list[i];
                }
                if(list[i] && i < list.length-1){
                    fields += ',';
                }
            }

        }
        if(this.statical){
            fields += (fields?',':'') + this.statical;
        }
        return fields || "*";
    }
    inc(data){
        if(!data){
            return this;
        }
        let updata = {}
        for(let k in data){
            if(data[k]){
                updata[k] = (data[k] > 0?'+':'-') + Math.abs(data[k]);
            }
        }
        return this.data(updata);
    }
    json(key,json){
        let tmp = {};
        //回车符会导致数据库报错
        tmp[key] = JSON.stringify(json).replace(/\\n/g,'\\\\n');
        return this.data(tmp);
    }
    data(data){
        if(!data){
            return this;
        }
        if(typeof data == 'string'){
            if(this.dataString){
                this.dataString += ",";
            }
            this.dataString += data;
        }
        else if(data){
            this.dataid = data.id;//自动根据id，进行更新
            let keys = Object.keys(data);
            for(let i = 0;i < keys.length;i++){
                if(keys[i] == 'id')
                    continue;
                let val = data[keys[i]];
                this.dataString += (this.dataString ? ",`" : "`") + keys[i] +"`=" ;
                if(typeof val == "number"){
                    this.dataString += val;
                }else if(typeof val == "string" && val.length > 1 && (val.indexOf('+')==0 || val.indexOf('-')==0 || val.indexOf('=')==0)){
                    // 设置增加 或者减少
                    this.dataString += "`"+keys[i] +"`"+ val;
                }else{
                    this.dataString += "'" + val + "'";
                }
            }
        }
        return this;
    }

    select(fields,addBracket){
        if(this.sqlString){
            // 重复调用则直接返回
            return this.sqlString;
        }
        // let sql = "SELECT $fields FROM $table $where $group $order $limit";
        let sql = "SELECT " + this._fieldAddDot(fields) + " FROM " + this.tablename;
        if(this.condition) sql += ' where ' + this.condition;
        if(this.groupStr) sql += ' group by ' + this.groupStr;
        if(this.orderStr) sql += ' order by ' + this.orderStr;
        if(this.limitStr) sql += ' limit ' + this.limitStr;
        this.sqlString = sql;
        if(addBracket){
            return "(" + sql + ")";
        }
        if(fields === false || !this.db){
            return this.sqlString;
        }else{
            return new Promise(async (resolve, reject) => {
                resolve(await this.query());
            })
        }
    }

    update(data){
        if(data){
            this.data(data);
        }
        if(!this.dataString){
            this.logError("error: update must have dataString");
            return (data === false)?'':false;
        }

        let sql = "UPDATE " + this.tablename + " SET " + this.dataString + " $where";
        if(!this.condition && this.dataid){
            this.sqlString = sql + ' where `id`='+ this.dataid;
        }else if(this.condition){
            this.sqlString = sql + ' where ' + this.condition;
        }else{
            Db.app.logger.info("error: update must have where condition");
            this.sqlString = "";
        }

        this.sqlString = sql;
        if(data === false || !this.db){
            return this.sqlString;
        }else{
            return new Promise(async (resolve, reject) => {
                resolve(await this.query());
            })
        }
    }

    insert(data){
        if(data){
            this.data(data);
        }
        if(!this.dataString){
            this.logError("error: update must have dataString");
            return (data === false)?'':false;
        }

        let sql = "INSERT INTO " + this.tablename + ' SET ' + this.dataString;
        if(this.condition){
            sql += ' where ' + this.condition;
        }

        this.sqlString = sql;
        if(data === false || !this.db){
            return this.sqlString;
        }else{
            return new Promise(async (resolve, reject) => {
                resolve(await this.query());
            })
        }
    }
    delete(where){
        if(where){
            this.where(where);
        }
        let sql = "DELETE FROM " + this.tablename + ' where ' + this.condition;
        this.sqlString = sql;
        if(where === false || !this.db){
            return this.sqlString;
        }else{
            return new Promise(async (resolve, reject) => {
                resolve(await this.query());
            })
        }
    }


    _staticalSql(key,oprate,buildOnly){
        if(!key){
            Db.app.logger.info("error: statical sql key is null");
            return this;
        }
        let statical = "$oprate(`$key`) as `$target`";
        statical = statical.replace("$oprate",oprate)
            .replace("$target",oprate);
        if(key != 1){
            statical = statical.replace("$key",key)
        }else{
            statical = statical.replace("`$key`",'1')
        }

        let sql = "SELECT $statical FROM $table $where $group ";
        sql = sql.replace("$statical",statical);
        sql = sql.replace("$table",this.tablename);
        sql = sql.replace("$where",this.condition?' where ' +this.condition:'');
        sql = sql.replace("$group",this.groupStr?' group by '+ this.groupStr : '' );

        this.sqlString = sql;
        if(this.statical){
            this.statical += ',' + statical;
        }else{
            this.statical = statical;
        }
        if(buildOnly){
            if(buildOnly == 'self'){
                return this;
            }
            return this.sqlString;
        }else if(!this.db){
            return this.sqlString;
        }
        return new Promise(async (resolve, reject) => {
            let result = await this.query();
            let value = result? (result[0][oprate]||0):0;
            resolve(value);
        })
    }
    //需要配合，query使用
    count(key,buildOnly){
        return this._staticalSql(key ||'1','count',buildOnly);
    }
    sum(key,buildOnly){
        return this._staticalSql(key,'sum',buildOnly);
    }
    max(key,buildOnly){
        return this._staticalSql(key,'max',buildOnly);
    }
    min(key,buildOnly){
        return this._staticalSql(key ,'min',buildOnly);
    }
    avg(key,buildOnly){
        return this._staticalSql(key,'avg',buildOnly);
    }
    //执行 sql 语句
    async query(sql){
        //this.app.db 为默认连接数据库
        sql = sql || this.sqlString;
        if(!sql){
            this.logError("no sql need to query");
            return null;
        }
        try{
            if(this.isPrintLog){
                console.log("exec sql begin>>:",sql);
            }

            // 数据库执行
            const result = await this.db.query(sql);

            if (this.isPrintLog ) {
                console.log("exec sql end>>:",result.length > 0?result[0]:result);
            }
            Db.lastSqlString = this.sqlString;
            this.statical = "";
            return result
        }catch (e) {
            if(this.isPrintLog){
                console.log("==== db error:",e.message,' sql:',e.sql);
            }
            this.logError("==== db error:",e.message,' sql:',e.sql);
        }
    }

    // 兼容egg mysql get 方法，返回第一个对象
    async get(where){
        let data = await this.where(where).select();
        if(data.length > 0){
            return data[0];
        }
        return null;
    }

    //数据库事物
    static async beginTransactionScope(dealer){
        let debugInfo = '';
        let conn = await Db.app.db.beginTransaction(); // 初始化事务
        let result = null;
        try {
            conn.table = function(name){
                debugInfo = new Error('\n====Db debug trace:')
                return Db.table(name,conn);
            };
            result = await dealer(conn);
            await conn.commit(); // 提交事务
        } catch (err) {
            // error, rollback
            await conn.rollback(); // 一定记得捕获异常后回滚事务！！
            // throw err;
            result = err;
            Db.app.logger.error(err,debugInfo);
        }

        return result;
    }
}

module.exports = Db;
