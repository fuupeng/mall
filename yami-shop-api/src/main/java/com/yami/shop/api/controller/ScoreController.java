package com.yami.shop.api.controller;

import cn.hutool.core.collection.CollectionUtil;
import com.yami.shop.bean.app.dto.*;
import com.yami.shop.bean.app.param.OrderShopParam;
import com.yami.shop.bean.app.param.SubmitOrderParam;
import com.yami.shop.bean.model.Order;
import com.yami.shop.bean.model.User;
import com.yami.shop.common.exception.YamiShopBindException;
import com.yami.shop.security.api.util.SecurityUtils;
import com.yami.shop.service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Objects;

/**
 * @program: mall4j-v2.3
 * @ClassName ScoreController
 * @description:
 * @author: fupeng
 * @create: 2023-04-17 13:59
 * @Version 1.0
 **/
@RestController
@RequestMapping("/p/score")
@Tag(name = "积分接口")
public class ScoreController {
    @Autowired
    private UserService userService;
    @Autowired
    private OrderService orderService;
    @Autowired
    private SkuService skuService;
    @Autowired
    private ProductService productService;
    @Autowired
    private BasketService basketService;

    @GetMapping("/getscore")
    public ResponseEntity<Integer> getScore() {
        String userId = SecurityUtils.getUser().getUserId();
        User user = userService.getBaseMapper().selectById(userId);
        return ResponseEntity.ok(user.getScore());
    }

    @PostMapping("/submit")
    @Operation(summary = "提交订单，返回支付流水号", description = "根据传入的参数判断是否为购物车提交订单，同时对购物车进行删除，用户开始进行支付")
    public ResponseEntity<OrderNumbersDto> submitOrders(@Valid @RequestBody SubmitOrderParam submitOrderParam) {
        String userId = SecurityUtils.getUser().getUserId();
        ShopCartOrderMergerDto mergerOrder = orderService.getConfirmOrderCache(userId);
        if (mergerOrder == null) {
            throw new YamiShopBindException("订单已过期，请重新下单");
        }

        List<OrderShopParam> orderShopParams = submitOrderParam.getOrderShopParam();

        List<ShopCartOrderDto> shopCartOrders = mergerOrder.getShopCartOrders();
        // 设置备注
        if (CollectionUtil.isNotEmpty(orderShopParams)) {
            for (ShopCartOrderDto shopCartOrder : shopCartOrders) {
                for (OrderShopParam orderShopParam : orderShopParams) {
                    if (Objects.equals(shopCartOrder.getShopId(), orderShopParam.getShopId())) {
                        shopCartOrder.setRemarks(orderShopParam.getRemarks());
                    }
                }
            }
        }

        List<Order> orders = orderService.submit(userId, mergerOrder);


        StringBuilder orderNumbers = new StringBuilder();
        for (Order order : orders) {
            orderNumbers.append(order.getOrderNumber()).append(",");
        }
        orderNumbers.deleteCharAt(orderNumbers.length() - 1);

        boolean isShopCartOrder = false;
        // 移除缓存
        for (ShopCartOrderDto shopCartOrder : shopCartOrders) {
            for (ShopCartItemDiscountDto shopCartItemDiscount : shopCartOrder.getShopCartItemDiscounts()) {
                for (ShopCartItemDto shopCartItem : shopCartItemDiscount.getShopCartItems()) {
                    Long basketId = shopCartItem.getBasketId();
                    if (basketId != null && basketId != 0) {
                        isShopCartOrder = true;
                    }
                    skuService.removeSkuCacheBySkuId(shopCartItem.getSkuId(), shopCartItem.getProdId());
                    productService.removeProductCacheByProdId(shopCartItem.getProdId());
                }
            }
        }
        // 购物车提交订单时(即有购物车ID时)
        if (isShopCartOrder) {
            basketService.removeShopCartItemsCacheByUserId(userId);
        }
        orderService.removeConfirmOrderCache(userId);

        Double actualTotal = mergerOrder.getActualTotal();
        // todo 积分比例
        userService.updateScore(userId, -actualTotal * 10000);
        orderService.updateByOrderId(orderNumbers.toString());
        return ResponseEntity.ok(new OrderNumbersDto(orderNumbers.toString()));
    }
}