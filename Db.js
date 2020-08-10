'use strict';
//用于生成sql 语句
const moment = require('moment');
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
            this.isPrintLog = Db.app.config.env !== "prod"
        }else{
            this.isPrintLog = true;
        }
        //默认为空
        this.logger = {
            info:function () {
                console.log(...arguments)
            },
            error:function () {
                console.log(...arguments)
            }
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

    setLogger(logger){
        if(logger){
            this.logger = logger;
        }
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
                        this.logger.info("error: type of 'between must be array of length = 2");
                    }
                }
                else if(op.indexOf('in') >= 0 || Array.isArray(val)){
                    this.condition += ' ' + op + " (";
                    if(typeof val == 'string'){
                        this.condition += val;
                    }else{
                        if(typeof val[0] == 'string'){
                            this.condition += "'"
                            this.condition += val.join("','")
                            this.condition += "'"
                        }else{
                            this.condition += val.join(',')
                        }
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

    _momOfCategory(category,offset) {
        // category = week,month,quarter
        let start = 0,end = 0;
        if(offset){
            let mom = moment()[category];
            switch (category) {
                case 'week':
                    start = moment().week(moment().week() + offset).startOf('week')
                    end = moment().week(moment().week() + offset).endOf('week')
                    break;
                case 'month':
                    start = moment().month(moment().month() + offset).startOf('month')
                    end = moment().month(moment().month() + offset).endOf('month')
                    break;
                case 'quarter':
                    start = moment().quarter(moment().quarter() + offset).startOf('quarter')
                    end = moment().quarter(moment().quarter() + offset).endOf('quarter')
                    break;
                case 'year':
                    start = moment().year(moment().year() + offset).startOf('year')
                    end = moment().year(moment().year() + offset).endOf('year')
                    break;
            }
        }else{
            start = moment().startOf(category)
            end = moment().endOf(category)
        }
        return {start:start.valueOf()/1000,end:Math.floor(end.valueOf()/1000)}
    }

    // 时间戳单位：秒
    whereTime(key,tm1,tm2){
        let cond = '';
        if(typeof tm1 == 'string'){
            let offset = parseInt(tm2 || 0);;
            let category = '';
            switch (tm1) {
                case 'today':
                    category = 'days';
                    break;
                case 'yesterday':
                    category = 'days';offset --;
                    break;
                case "tomorrow":
                    category = 'days';offset ++;
                    break;
                case 'week':
                case 'month':
                case 'quarter':
                case 'year':
                    category = tm1;
                    offset = parseInt(tm2 || 0);
                    break;
                case 'lastWeek':
                    category = 'week';offset = -1;
                    break;
                case 'lastMonth':
                    category = 'month';offset = -1;
                    break;
                case 'lastQuarter':
                    category = 'quarter';offset = -1;
                    break;
                case 'lastYear':
                    category = 'year';offset = -1;
                    break;
                default:
                    if(tm1.indexOf('-') > 0){// 判断为时间格式：YYYY-MM-DD
                        cond = "FROM_UNIXTIME(" + key + ",'%Y-%m-%d') = '" + tm + "'";    
                    }else{
                        console.log("db whereTime invalid params:",key,tm1);
                        return null;
                    }
            }

            if(category == 'days'){
                cond = "FROM_UNIXTIME(" + key + ",'%Y-%m-%d') =" + moment().add(offset, 'days').format("'YYYY-MM-DD'");
            }else if(category){
                const {start,end} = this._momOfCategory(category,offset);
                cond = `(${key} >= ${start} and ${key} <= ${end})`    
            }
            // this.condition
            
        }else if(tm1 && !tm2){
            if (tm1 > 100000000) {// 可以判断为秒数或者毫秒
                if(tm1 > (Date.now()/100)){//根据数量级判断为毫秒
                    cond = "FROM_UNIXTIME(" + key + ",'%Y-%m-%d') =" + moment(tm1).format("'YYYY-MM-DD'");
                }else{
                    cond = "FROM_UNIXTIME(" + key + ",'%Y-%m-%d') =" + moment(tm1 * 1000).format("'YYYY-MM-DD'");    
                }
            } else if(tm1 < 366){//以当天为基准的日期偏移
                cond = "FROM_UNIXTIME(" + key + ",'%Y-%m-%d') =" + moment().add(tm1, 'days').format("'YYYY-MM-DD'");
            } else {//判断为年月日
                cond = "FROM_UNIXTIME(" + key + ",'%Y%m%d') = '" + tm1 + "'";
            }
        }else if(tm2){//判断为日期中间
            if(!tm1){
                tm1 = Date.now();//从当前时间开始
            }else{
                tm1 = (tm1 > (Date.now()/100))?tm1:(tm1*1000)//秒转换为毫秒
            }
            tm2 = (tm2 > (Date.now()/100))?tm2:(tm2*1000)//秒转换为毫秒

            let start = moment(tm1).startOf('days').valueOf()/1000;
            let end = Math.floor(moment(tm2).endOf('days').valueOf()/1000);

            cond = `(${key} >= ${start} and ${key} <= ${end})`;
        }else{//不设置之间参数，这表示今天
            console.log("db whereTime invalid params: tm1 is null");
            return null;
        }
        if(this.condition){
            this.condition += ' AND ' + cond;
        }else{
            this.condition += cond;
        }
        return this;
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
    // 判断并添加点号,以避免因数据库关键字的错误
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
    data(data,action){
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
            if(action != 'insert'){
                this.dataid = data.id;//自动根据id，进行更新    
            }
            
            let keys = Object.keys(data);
            for(let i = 0;i < keys.length;i++){
                if(keys[i] == 'id' && action != 'insert')
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

        this.sqlString = "SELECT " + this._fieldAddDot(fields) + " FROM " + this.tablename;
        if(this.condition) this.sqlString += ' where ' + this.condition;
        if(this.groupStr) this.sqlString += ' group by ' + this.groupStr;
        if(this.orderStr) this.sqlString += ' order by ' + this.orderStr;
        if(this.limitStr) this.sqlString += ' limit ' + this.limitStr;
        if(addBracket){
            return "(" + this.sqlString + ")";
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
            this.logger.error("error: update must have dataString");
            return (data === false)?'':false;
        }

        this.sqlString = "UPDATE " + this.tablename + " SET " + this.dataString;

        if(!this.condition && this.dataid){
            this.sqlString += ' where `id`='+ this.dataid;
        }else if(this.condition){
            this.sqlString += ' where ' + this.condition;
        }else{
            this.logger.info("error: update must have where condition");
            this.sqlString = "";
        }

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
            this.data(data,'insert');
        }
        if(!this.dataString){
            this.logger.error("error: update must have dataString");
            return (data === false)?'':false;
        }

        this.sqlString = "INSERT INTO " + this.tablename + ' SET ' + this.dataString;
        if(this.condition){
            this.sqlString += ' where ' + this.condition;
        }

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
        this.sqlString = "DELETE FROM " + this.tablename + ' where ' + this.condition;
        if(where === false || !this.db){
            return this.sqlString;
        }else{
            return new Promise(async (resolve, reject) => {
                resolve(await this.query());
            })
        }
    }


    _staticalSql(key,operate,buildOnly){
        if(!key){
            this.logger.info("error: statical sql key is null,operate=",operate);
            return this;
        }
        let statical = "$operate($key) as `$target`";
        statical = statical.replace("$operate",operate)
            .replace("$target",operate);
        if(key != 1){
            statical = statical.replace("$key",key)
        }else{
            statical = statical.replace("$key",'1')
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
            const result = await this.query();
            resolve(result[0][operate] || 0);
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
            this.logger.error("no sql need to query");
            return null;
        }
        try{
            if(this.isPrintLog){
                this.logger.info("exec sql begin>>:",sql);
            }

            // 数据库执行
            const result = await this.db.query(sql);

            // if (this.isPrintLog ) {
            //     console.log("exec sql end>>:",result.length > 0?result[0]:result);
            // }
            Db.lastSqlString = this.sqlString;
            this.statical = "";
            return result
        }catch (e) {
            this.logger.error("==== db error:",e.message,' sql:',e.sql);
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
