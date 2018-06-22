"use strict";

var BabyDiaryPlatform = function () {
    LocalContractStorage.defineMapProperty(this, "diaryInfos");//日记购买关联表
    LocalContractStorage.defineMapProperty(this, "userInfos");//用户信息表
    LocalContractStorage.defineMapProperty(this, "msgs");
    LocalContractStorage.defineProperty(this, "photos");
    LocalContractStorage.defineProperty(this, "users");

    LocalContractStorage.defineProperty(this, "name");
};

BabyDiaryPlatform.prototype = {
    init: function () {
        this.photos = [];
        this.users = [];
    },
    storageTest: function (name, value) {
        this.name = name;
    },

    /**
     * 创建宝贝儿账号
     * @param name
     */
    createBabyAccount: function (name) {
        var from = Blockchain.transaction.from;
        if (name === '') {
            throw new Error('宝贝姓名不能为空！');
        }
        var userInfo = this.userInfos.get(from);
        if (!userInfo) {
            this._initUserInfo(from, 1)
        }
        userInfo = this.userInfos.get(from);

        userInfo.babyName = name;
        this.userInfos.put(from, userInfo);
        return "success";
    },
    /**
     * 获取我的日记
     * @param offset
     * @param size
     * @returns {*|Array}
     */
    getMyDiary: function (from, offset, size) {
        var photos = this.photos;
        var result = [];
        for (var i = 0; i < photos.length; i++) {
            var photo = photos[i];
            if (photo.from == from) {
                result.push(photo);
            }
        }
        result = result.sort(function (a, b) {
            return b.ts - a.ts;
        })
        return this._page(result, offset, size);
    },
    getHotShares: function (offset, size) {
        var photos = this.photos;
        var diaryInfos = this.diaryInfos;
        photos = photos.sort(function (a, b) {
            var aInfo = diaryInfos.get(a.id);
            var bInfo = diaryInfos.get(b.id);
            if (aInfo.buyers.length == 0 && bInfo.buyers.length == 0) {
                return a.price - b.price;
            } else {
                return -(a.price * (aInfo.buyers.length + aInfo.good - aInfo.bad) - b.price * (bInfo.buyers.length + bInfo.good - bInfo.bad));
            }
        })
        return this._page(photos, offset, size);
    },
    _initUserInfo: function (from, avatar) {
        var userInfo = this.userInfos.get(from);
        if (!userInfo) {
            var users = this.users;
            users.push(from);
            this.users = users;

            userInfo = {
                'income': 0,
                'spend': 0,
                'good': 0,
                'bad': 0,
                'post': 0,
                'babyName': "baby",
                'avatar': avatar
            }
            this.userInfos.put(from, userInfo);
        }
    },
    _page: function (items, offset, size) {
        var start = offset;
        var end = start + size;
        if (end > items.length) {
            end = items.length;
        }
        var result = [];
        for (var i = start; i < end; i++) {
            var item = items[i];
            if (item) {
                var photoInfo = this.diaryInfos.get(item.id);
                item.buyers = photoInfo.buyers;
                item.good = photoInfo.good;
                item.bad = photoInfo.bad;
                item.ext = photoInfo.ext;
                item.babyName = this.userInfos.get(photoInfo.from).babyName;
                item.avatar = this.userInfos.get(photoInfo.from).avatar;
                item.user = this.userInfos.get(photoInfo.from);
                result.push(items[i]);
            }
        }
        return result;
    },
    getNewShares: function (offset, size) {
        var photos = this.photos;
        photos = photos.sort(function (a, b) {
            return b.ts - a.ts;
        })
        return this._page(photos, offset, size);
    },
    getSharesByKeyword: function (keyword, offset, size) {
        var result = [];
        var photos = this.photos;
        for (var i = 0; i < photos.length; i++) {
            var photo = photos[i];
            if (photo.title.indexOf(keyword) != -1) {
                result.push(photo);
            }
        }
        return this._page(result, offset, size);
    },
    buy: function (id, avatar) {
        var phototInfo = this.diaryInfos.get(id);
        var from = Blockchain.transaction.from;
        var value = Blockchain.transaction.value;
        this._initUserInfo(from, avatar);
        if (phototInfo.price == value) {
            var result = Blockchain.transfer(phototInfo.from, value);
            if (result) {
                var userInfo = this.userInfos.get(phototInfo.from);
                userInfo.income = new BigNumber(value).plus(userInfo.income);
                this.userInfos.put(phototInfo.from, userInfo);

                var userInfo2 = this.userInfos.get(from);
                userInfo2.spend = new BigNumber(value).plus(userInfo2.spend);
                this.userInfos.put(from, userInfo2);
            }
            var buyers = phototInfo.buyers;
            var buyer = {
                'from': from,
                'ts': new Date().getTime(),
                'success': result,
                'like': 0
            }
            buyers.push(buyer);
            phototInfo.buyers = buyers;
            this.diaryInfos.put(id, phototInfo);


            var ext = [];
            ext.push(phototInfo.price);
            ext.push(value);
            ext.push('pay:' + result);
            phototInfo.ext = ext;
            this.diaryInfos.put(id, phototInfo);
        } else {
            throw new Error('Error');
        }
    },
    getMakeMoneyWay: function (id, from) {
        var photoInfo = this.diaryInfos.get(id);
        if (photoInfo.from == from) {
            return photoInfo.content;
        }
        for (var i = 0; i < photoInfo.buyers.length; i++) {
            if (photoInfo.buyers[i].from == from && photoInfo.buyers[i].success == true) {
                return photoInfo.content;
            }
        }
        return "";
    },
    good: function (id) {
        var photoInfo = this.diaryInfos.get(id);
        var from = Blockchain.transaction.from;
        for (var i = 0; i < photoInfo.buyers.length; i++) {
            if (photoInfo.buyers[i].from == from && photoInfo.buyers[i].success == true) {
                var userInfo = this.userInfos.get(photoInfo.from);
                var old = photoInfo.buyers[i].like;
                if (old == 0) {
                    photoInfo.good++;
                    userInfo.good++;
                } else if (old == -1) {
                    photoInfo.bad--;
                    photoInfo.good++;
                    userInfo.good++;
                    userInfo.bad--;
                } else if (old == 1) {
                    // do nothind
                }
                this.userInfos.put(photoInfo.from, userInfo);
                photoInfo.buyers[i].like = 1;
                this.diaryInfos.put(id, photoInfo);
                return 'success';
            }
        }
        return 'do not match buyer';
    },
    bad: function (id) {
        var photoInfo = this.diaryInfos.get(id);
        var from = Blockchain.transaction.from;
        for (var i = 0; i < photoInfo.buyers.length; i++) {
            if (photoInfo.buyers[i].from == from && photoInfo.buyers[i].success == true) {
                var userInfo = this.userInfos.get(photoInfo.from);
                var old = photoInfo.buyers[i].like;
                if (old == 0) {
                    userInfo.bad++;
                    photoInfo.bad++;
                } else if (old == -1) {
                    // do nothind
                } else if (old == 1) {
                    photoInfo.good--;
                    photoInfo.bad++;
                    userInfo.good--;
                    userInfo.bad++;
                }
                this.userInfos.put(photoInfo.from, userInfo);
                photoInfo.buyers[i].like = -1;
                this.diaryInfos.put(id, photoInfo);
                return 'success';
            }
        }
        return 'do not match buyer';
    },
    getHotUsers: function (offset, size) {
        var users = this.users;
        var t = this;
        users = users.sort(function (a, b) {
            var aInfo = t.userInfos.get(a);
            var bInfo = t.userInfos.get(b);
            return new BigNumber(bInfo.income) + new BigNumber(bInfo.spend) - new BigNumber(aInfo.income) - new BigNumber(aInfo.spend);
        })
        var start = offset;
        var end = start + size;
        if (end > users.length) {
            end = users.length;
        }
        var result = [];
        for (var i = start; i < end; i++) {
            var item = users[i];
            if (item) {
                var photoInfo = this.userInfos.get(item);
                photoInfo.address = item;
                result.push(photoInfo);
            }
        }
        return result;
    },
    /**
     * 获取用户信息
     * @param from
     * @returns {*}
     */
    getUserInfo: function (from) {
        var userInfo = this.userInfos.get(from);
        if (userInfo) {
            return userInfo;
        }
        return '';
    },
    sendMsg: function (to, content) {
        var from = Blockchain.transaction.from;
        var msg = {
            'from': from,
            'to': to,
            'content': content,
            'ts': new Date().getTime()
        }
        var msgs = this.msgs.get(to) || [];
        msgs.push(msg);
        this.msgs.put(to, msgs);
    },
    post: function (title, content, price, avatar) {
        if (title === '') {
            throw new Error('日记名称不能为空！');
        }
        if (content === '') {
            throw new Error('日记内容不能为空！');
        }
        if (title.length > 64) {
            throw new Error('日记名称不能超过64个字符！');
        }
        price = new BigNumber(price);
        var from = Blockchain.transaction.from;
        var photos = this.photos;
        var id = photos.length + 1;
        var photo = {
            'title': title,
            'from': from,
            'ts': new Date().getTime(),
            'id': id,
            'price': price,

        }
        photos.push(photo);
        this.photos = photos;
        var photoInfo = {
            'content': content,
            'price': price,
            'buyers': [],
            'from': from,
            'good': 0,
            'bad': 0
        }
        this.diaryInfos.put(id, photoInfo);

        //更新用户发布次数
        this._initUserInfo(from, avatar);
        var userInfo = this.userInfos.get(from);
        userInfo.post++;
        this.userInfos.put(from, userInfo);

        return 'success';
    }

};
module.exports = BabyDiaryPlatform;