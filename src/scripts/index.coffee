SCROLL_SPEED = 0
SCROLL_MIN_SPEED = 0.01
SCROLL_MAX_SPEED = 20

SCROLL_SPEED_WHEEL = 1
SCROLL_SPEED_ARROW = SCROLL_SPEED_WHEEL
SCROLL_SPEED_PAGE = SCROLL_MAX_SPEED

SCROLL_FRICTION = 0.95

u document
    .on 'wheel', (ev) ->
        if not window.matchMedia('(max-width: 600px)').matches
            SCROLL_SPEED += Math.sign(ev.deltaY) * SCROLL_SPEED_WHEEL

u document
    .on 'keydown', (ev) ->
        if not window.matchMedia('(max-width: 600px)').matches
            switch ev.code
                when 'Home'
                    u("main").nodes[0].scrollLeft = 0
                when 'End'
                    u("main").nodes[0].scrollLeft = u(".post").size().width * u(".post").length
                when 'ArrowUp', 'ArrowLeft'
                    SCROLL_SPEED -= SCROLL_SPEED_ARROW
                when 'ArrowDown', 'ArrowRight'
                    SCROLL_SPEED += SCROLL_SPEED_ARROW
                when 'PageUp'
                    SCROLL_SPEED -= SCROLL_SPEED_PAGE
                when 'PageDown', 'Space'
                    SCROLL_SPEED += SCROLL_SPEED_PAGE

TIME_1 = undefined

scroll = (TIME_NOW) ->
    if TIME_1 == undefined
        TIME_1 = TIME_NOW

    TIME_DELTA = TIME_NOW - TIME_1
    TIME_1 = TIME_NOW

    u("main").nodes[0].scrollLeft += SCROLL_SPEED * TIME_DELTA
    SCROLL_SPEED *= Math.pow(SCROLL_FRICTION, TIME_DELTA)

    if Math.abs SCROLL_SPEED < SCROLL_MIN_SPEED
        SCROLL_SPEED = 0

    if Math.abs SCROLL_SPEED > SCROLL_MAX_SPEED
        SCROLL_SPEED = SCROLL_MAX_SPEED * Math.sign(SCROLL_SPEED)

    requestAnimationFrame scroll

requestAnimationFrame scroll

resize = -> 
    u ".post"
        .each (el) ->
            p_el = u el
                .find '.text p'
            
            u p_el
                .children ".overflow"
                .removeClass "overflow"
        
            u p_el
                .children ".elipsis"
                .remove()

            text = u(p_el).text()

            mid = 0 
            while el.clientHeight < el.scrollHeight and mid < text.split(' ').length
                mid++

                pre = text
                    .split ' '
                    .slice 0, -mid

                pos = text
                    .split ' '
                    .slice -mid

                u p_el
                    .html pre.join(' ') + '<span class="elipsis"> ... </span> <span class="overflow">' + pos.join(' ') + '</span>'

window.addEventListener 'resize', resize
window.addEventListener 'load', resize