// pages/submit-order/submit-order.js
var http = require("../../utils/http.js");
Page({

    /**
     * 页面的初始数据
     */
    data: {
        popupShow: false,
        couponSts: 1,
        myScore: 0,
        couponList: [],
        // 订单入口 0购物车 1立即购买
        orderEntry: "0",
        userAddr: null,
        orderItems: [],
        coupon: {
            totalLength: 0,
            canUseCoupons: [],
            noCanUseCoupons: []
        },
        actualTotal: 0,
        total: 0,
        totalCount: 0,
        transfee: 0,
        reduceAmount: 0,
        remark: "",
        couponIds: []
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        this.setData({
            orderEntry: options.orderEntry,
        });
        this.getMyScore()
    },

    //加载订单数据
    loadOrderData: function () {
        var addrId = 0;
        if (this.data.userAddr != null) {
            addrId = this.data.userAddr.addrId;
        }
        wx.showLoading({
            mask: true
        });
        var params = {
            url: "/p/order/confirm",
            method: "POST",
            data: {
                addrId: addrId,
                orderItem: this.data.orderEntry === "1" ? JSON.parse(wx.getStorageSync("orderItem")) : undefined,
                basketIds: this.data.orderEntry === "0" ? JSON.parse(wx.getStorageSync("basketIds")) : undefined,
                couponIds: this.data.couponIds,
                userChangeCoupon: 1
            },
            callBack: res => {
                wx.hideLoading();
                let orderItems = [];

                res.shopCartOrders[0].shopCartItemDiscounts.forEach(itemDiscount => {
                    orderItems = orderItems.concat(itemDiscount.shopCartItems)
                })
                if (res.shopCartOrders[0].coupons) {
                    let canUseCoupons = []
                    let unCanUseCoupons = []
                    res.shopCartOrders[0].coupons.forEach(coupon => {
                        if (coupon.canUse) {
                            canUseCoupons.push(coupon)
                        } else {
                            unCanUseCoupons.push(coupon)
                        }
                    })
                    this.setData({
                        coupons: {
                            totalLength: res.shopCartOrders[0].coupons.length,
                            canUseCoupons: canUseCoupons,
                            unCanUseCoupons: unCanUseCoupons
                        }
                    })
                }

                this.setData({
                    orderItems: orderItems,
                    actualTotal: res.actualTotal,
                    total: res.total,
                    totalCount: res.totalCount,
                    userAddr: res.userAddr,
                    transfee: res.shopCartOrders[0].transfee,
                    shopReduce: res.shopCartOrders[0].shopReduce,
                });
            },
            errCallBack: res => {
                wx.hideLoading();
                this.chooseCouponErrHandle(res)
            }
        };
        http.request(params);

    },

    /**
     * 优惠券选择出错处理方法
     */
    chooseCouponErrHandle(res) {
        // 优惠券不能共用处理方法
        if (res.statusCode == 601) {
            wx.showToast({
                title: res.data,
                icon: "none",
                duration: 3000,
                success: res => {
                    this.setData({
                        couponIds: []
                    })
                }
            })
            setTimeout(() => {
                this.loadOrderData();
            }, 2500)
        }
    },

    onRemarksInput: function (e) {
        this.setData({
            remarks: e.detail.value
        });
    },

    /**
     * 提交订单
     */
    toPay: function () {
        if (!this.data.userAddr) {
            wx.showToast({
                title: '请选择地址',
                icon: "none"
            })
            return;
        }

        this.submitOrder();
    },


    submitOrder: function () {
        wx.showLoading({
            mask: true
        });
        console.log({
            remarks: this.data.remark,
            shopId: 1
        });
        var params = {
            url: "/p/order/submit",
            method: "POST",
            data: {
                orderShopParam: [{
                    remarks: this.data.remark,
                    shopId: 1
                }]
            },
            callBack: res => {
                wx.hideLoading();
                this.calWeixinPay(res.orderNumbers);
            }
        };
        http.request(params);
    },

    /**
     * 唤起微信支付
     */
    calWeixinPay: function (orderNumbers) {
        wx.showLoading({
            mask: true
        });
        var params = {
            url: "/p/order/pay",
            method: "POST",
            data: {
                payType: 1,
                orderNumbers: orderNumbers
            },
            callBack: function (res) {
                wx.hideLoading();
                wx.requestPayment({
                    timeStamp: res.timeStamp,
                    nonceStr: res.nonceStr,
                    package: res.packageValue,
                    signType: res.signType,
                    paySign: res.paySign,
                    success: e => {
                        // console.log("支付成功");
                        wx.navigateTo({
                            url: '/pages/pay-result/pay-result?sts=1&orderNumbers=' + orderNumbers + "&orderType=" + this.data.orderType,
                        })
                    },
                    fail: err => {
                        // wx.navigateTo({
                        //     url: '/pages/pay-result/pay-result?sts=0&orderNumbers=' + orderNumbers + "&orderType=" + this.data.orderType,
                        // })
                        wx.navigateTo({
                            url: '/pages/pay-result/pay-result?sts=1&orderNumbers=' + orderNumbers + "&orderType=" + this.data.orderType,
                        })
                    }
                })

            }
        };
        http.request(params);
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function () {
        var pages = getCurrentPages();
        var currPage = pages[pages.length - 1];
        if (currPage.data.selAddress == "yes") {
            this.setData({ //将携带的参数赋值
                userAddr: currPage.data.item
            });
        }
        //获取订单数据
        this.loadOrderData();
    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function () {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh: function () {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom: function () {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function () {

    },

    changeCouponSts: function (e) {
        this.setData({
            couponSts: e.currentTarget.dataset.sts
        });
    },

    showCouponPopup: function () {
        this.setData({
            popupShow: true
        });
    },

    closePopup: function () {
        this.setData({
            popupShow: false
        });
    },

    /**
     * 去地址页面
     */
    toAddrListPage: function () {
        wx.navigateTo({
            url: '/pages/delivery-address/delivery-address?order=0',
        })
    },
    /**
     * 确定选择好的优惠券
     */
    choosedCoupon: function () {
        this.loadOrderData();
        this.setData({
            popupShow: false
        });
    },

    /**
     * 优惠券子组件发过来
     */
    checkCoupon: function (e) {
        var ths = this;
        let index = ths.data.couponIds.indexOf(e.detail.couponId);
        if (index === -1) {
            ths.data.couponIds.push(e.detail.couponId)
        } else {
            ths.data.couponIds.splice(index, 1)
        }
    },
    /**
     * 积分支付组件发过来
     */

    scorePay: function (e) {
        console.log(this.data);
        wx.showModal({
            title: '提示',
            content: `您现有积分${this.data.myScore},是否使用积分支付`,
            success: (res) => {
                if (res.confirm) {//这里是点击了确定以后
                    // todo 积分比例
                    if (this.data.actualTotal * 10000 > this.data.myScore) {
                        return wx.showToast({
                            title: '积分不足',
                            icon: 'error',
                            duration: 2000
                        })
                    }
                    this.scorePayApi()
                } else {//这里是点击了取消以后
                    console.log('用户点击取消')
                }
            }
        })

    },
    /**
 * 我的积分
 */
    getMyScore: function () {
        var params = {
            url: '/p/score/getscore',
            method: 'GET',
            data: {},
            callBack: (res) => {
                this.setData({
                    myScore: res
                })
            }
        }
        http.request(params)
    },
    scorePayApi: function () {
        wx.showLoading({
            mask: true
        });

        var params = {
            url: "/p/score/submit",
            method: "POST",
            data: {
                orderShopParam: [{
                    remarks: this.data.remark,
                    shopId: 1
                }]
            },
            callBack: res => {
                wx.hideLoading();
                // this.calWeixinPay(res.orderNumbers);
                this.calScorePay(res.orderNumbers)
            }
        };
        http.request(params);
    },
    calScorePay: function (orderNumbers) {
        wx.showLoading({
            mask: true
        });
        var params = {
            url: "/p/order/pay",
            method: "POST",
            data: {
                payType: 1,
                orderNumbers: orderNumbers
            },
            callBack: function (res) {
                wx.hideLoading();
                wx.navigateTo({
                    url: '/pages/pay-result/pay-result?sts=1&orderNumbers=' + orderNumbers + "&orderType=" + this.data.orderType,
                })
            }
        };
        http.request(params);
    },
})