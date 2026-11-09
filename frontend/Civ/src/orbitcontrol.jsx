// Camera control around the globe: drag to rotate, wheel or pinch to zoom.
// Built on Pointer Events, so mouse, touch and pen all work, and attached to
// the canvas (not window) so dragging inside a popup doesn't spin the globe.

export default function OrbitControl(camera, popupRef){

    return {
        // orbit control states and parameters
        autoRotate: true, rotateSpeed: 0.01, zoomSpeed: 1.2, minDistance: 2, maxDistance: 100,
        minPolarAngle: 0.01, maxPolarAngle: Math.PI - 0.01,
        distance: 3, theta: 0, phi: Math.PI / 2,
        targetTheta: 0, targetPhi: Math.PI / 2, targetDistance: 3,
        pointers: new Map(),          // pointerId -> {x, y} for every finger/mouse currently down
        pinchDistance: null,
        element: null,

        init(element){
            this.element = element;
            // Without this the browser scrolls/zooms the page instead of the globe on touch screens.
            element.style.touchAction = "none";

            this._down = (e) => this.onPointerDown(e);
            this._move = (e) => this.onPointerMove(e);
            this._up = (e) => this.onPointerUp(e);
            this._wheel = (e) => this.onWheel(e);

            element.addEventListener("pointerdown", this._down);
            element.addEventListener("pointermove", this._move);
            element.addEventListener("pointerup", this._up);
            element.addEventListener("pointercancel", this._up);
            element.addEventListener("wheel", this._wheel, { passive: false });
        },

        dispose(){
            if(!this.element) return;
            this.element.removeEventListener("pointerdown", this._down);
            this.element.removeEventListener("pointermove", this._move);
            this.element.removeEventListener("pointerup", this._up);
            this.element.removeEventListener("pointercancel", this._up);
            this.element.removeEventListener("wheel", this._wheel);
            this.pointers.clear();
            this.element = null;
        },

        get isDragging(){
            return this.pointers.size > 0;
        },

        onPointerDown(e){
            // Keep receiving moves even if the pointer leaves the canvas mid-drag.
            this.element.setPointerCapture?.(e.pointerId);
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            this.pinchDistance = this.pointers.size === 2 ? this.currentPinchDistance() : null;
        },

        onPointerMove(e){
            const previous = this.pointers.get(e.pointerId);
            if(!previous) return;
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if(this.pointers.size === 2){
                // Pinch: fingers apart -> zoom in, together -> zoom out
                const distance = this.currentPinchDistance();
                if(this.pinchDistance && distance > 0){
                    this.setTargetDistance(this.targetDistance * (this.pinchDistance / distance));
                }
                this.pinchDistance = distance;
                return;
            }

            if(this.pointers.size === 1){
                this.targetTheta -= (e.clientX - previous.x) * this.rotateSpeed;
                this.targetPhi = Math.max(
                    this.minPolarAngle,
                    Math.min(this.maxPolarAngle, this.targetPhi + (e.clientY - previous.y) * this.rotateSpeed)
                );
            }
        },

        onPointerUp(e){
            this.pointers.delete(e.pointerId);
            this.pinchDistance = this.pointers.size === 2 ? this.currentPinchDistance() : null;
        },

        onWheel(e){
            e.preventDefault();
            const direction = e.deltaY > 0 ? 1 : -1;
            this.setTargetDistance(this.targetDistance * Math.pow(this.zoomSpeed, direction * 0.1));
        },

        currentPinchDistance(){
            const [a, b] = [...this.pointers.values()];
            return Math.hypot(a.x - b.x, a.y - b.y);
        },

        setTargetDistance(distance){
            this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
        },

        update(){

            if(this.autoRotate && !this.isDragging && !popupRef.current){
                this.targetTheta += 0.0007;
            }

            const easing = 0.1;

            this.theta += (this.targetTheta - this.theta) * easing;
            this.phi += (this.targetPhi - this.phi) * easing;
            this.distance += (this.targetDistance - this.distance) * easing;

            const x = this.distance * Math.sin(this.phi) * Math.cos(this.theta);
            const y = this.distance * Math.cos(this.phi);
            const z = this.distance * Math.sin(this.phi) * Math.sin(this.theta);

            camera.position.set(x, y, z);

            camera.lookAt(0, 0, 0);
        }
    };
}
